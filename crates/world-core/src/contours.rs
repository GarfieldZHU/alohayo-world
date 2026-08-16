//! Coarse contour/frontier geometry preparation for the Wasm worker.
//!
//! This module deliberately stops at topology. It emits deterministic cell-corner paths
//! and leaves smoothing style, feathering, gradients, masks, PixiJS paths, and visibility
//! authority to TypeScript. The one-cell `known_halo` makes streamed frontiers explicit:
//! unknown samples suppress edges rather than being interpreted as land or water.

use crate::batches::ContourGeometry;
use crate::shape::checked_raster_size;

/// Version of the contour geometry input/output contract.
pub const CONTOUR_GEOMETRY_ABI_VERSION: u32 = 1;

#[derive(Clone, Copy)]
struct Edge {
    start_x: i32,
    start_y: i32,
    end_x: i32,
    end_y: i32,
}

fn halo_size(width: usize, height: usize) -> usize {
    let halo_width = width
        .checked_add(2)
        .unwrap_or_else(|| panic!("contour known halo width overflow"));
    let halo_height = height
        .checked_add(2)
        .unwrap_or_else(|| panic!("contour known halo height overflow"));
    checked_raster_size(halo_width, halo_height, "contour known halo")
}

fn halo_index(width: usize, height: usize, x: i32, y: i32) -> Option<usize> {
    if x < -1 || y < -1 || x > width as i32 || y > height as i32 {
        return None;
    }
    Some((y + 1) as usize * (width + 2) + (x + 1) as usize)
}

fn known_at(known_halo: &[u8], width: usize, height: usize, x: i32, y: i32) -> bool {
    // Coordinates outside the one-cell contract are malformed input rather than an
    // unknown frontier. The caller should provide a halo for every neighbor queried.
    if y < -1 || y > height as i32 || x < -1 || x > width as i32 {
        return false;
    }
    halo_index(width, height, x, y)
        .map(|index| known_halo[index] != 0)
        .unwrap_or(false)
}

fn inside_at(inside: &[u8], width: usize, height: usize, x: i32, y: i32) -> bool {
    if x < 0 || y < 0 || x >= width as i32 || y >= height as i32 {
        return false;
    }
    inside[y as usize * width + x as usize] != 0
}

fn add_frontier_edges(inside: &[u8], known_halo: &[u8], width: usize, height: usize) -> Vec<Edge> {
    let mut edges = Vec::new();
    for y in 0..height as i32 {
        for x in 0..width as i32 {
            if !known_at(known_halo, width, height, x, y) || !inside_at(inside, width, height, x, y)
            {
                continue;
            }
            // Match the TypeScript reference's clockwise edge order exactly.
            if known_at(known_halo, width, height, x, y - 1)
                && !inside_at(inside, width, height, x, y - 1)
            {
                edges.push(Edge {
                    start_x: x,
                    start_y: y,
                    end_x: x + 1,
                    end_y: y,
                });
            }
            if known_at(known_halo, width, height, x + 1, y)
                && !inside_at(inside, width, height, x + 1, y)
            {
                edges.push(Edge {
                    start_x: x + 1,
                    start_y: y,
                    end_x: x + 1,
                    end_y: y + 1,
                });
            }
            if known_at(known_halo, width, height, x, y + 1)
                && !inside_at(inside, width, height, x, y + 1)
            {
                edges.push(Edge {
                    start_x: x + 1,
                    start_y: y + 1,
                    end_x: x,
                    end_y: y + 1,
                });
            }
            if known_at(known_halo, width, height, x - 1, y)
                && !inside_at(inside, width, height, x - 1, y)
            {
                edges.push(Edge {
                    start_x: x,
                    start_y: y + 1,
                    end_x: x,
                    end_y: y,
                });
            }
        }
    }
    edges
}

fn vertex_index(width: usize, x: i32, y: i32) -> usize {
    y as usize * (width + 1) + x as usize
}

fn trace_paths(edges: &[Edge], width: usize, height: usize) -> Vec<(Vec<f64>, bool)> {
    let mut by_start = vec![Vec::<usize>::new(); (width + 1) * (height + 1)];
    for (index, edge) in edges.iter().enumerate() {
        by_start[vertex_index(width, edge.start_x, edge.start_y)].push(index);
    }

    let mut used = vec![false; edges.len()];
    let mut paths = Vec::new();
    for start_index in 0..edges.len() {
        if used[start_index] {
            continue;
        }
        let start = edges[start_index];
        let mut points = vec![start.start_x as f64, start.start_y as f64];
        let mut edge_index = start_index;
        let mut closed = false;
        while !used[edge_index] {
            let edge = edges[edge_index];
            used[edge_index] = true;
            points.push(edge.end_x as f64);
            points.push(edge.end_y as f64);
            if edge.end_x == start.start_x && edge.end_y == start.start_y {
                closed = true;
                break;
            }
            let candidates = &by_start[vertex_index(width, edge.end_x, edge.end_y)];
            let next = candidates
                .iter()
                .copied()
                .find(|candidate| !used[*candidate]);
            match next {
                Some(candidate) => edge_index = candidate,
                None => break,
            }
        }
        if points.len() >= 4 {
            if closed {
                points.truncate(points.len() - 2);
            }
            paths.push((points, closed));
        }
    }
    paths
}

fn close_path(mut points: Vec<f64>, closed: bool) -> Vec<f64> {
    if closed && points.len() >= 4 {
        points.push(points[0]);
        points.push(points[1]);
    }
    points
}

/// Prepare deterministic chunk-local frontier paths from a binary mask.
///
/// `inside` is `width * height` bytes. `known_halo` is `(width + 2) * (height + 2)`
/// bytes with the interior at offset `(1, 1)`; a zero byte means that sample is
/// unknown. The halo must explicitly mark every neighbor that can be considered for an
/// edge. The result contains no renderer state and is safe to compute in a worker.
pub fn prepare_contour_geometry(
    inside: &[u8],
    known_halo: &[u8],
    width: usize,
    height: usize,
    origin_x: i32,
    origin_y: i32,
) -> ContourGeometry {
    let size = checked_raster_size(width, height, "contour mask");
    assert_eq!(inside.len(), size, "contour inside mask length mismatch");
    assert_eq!(
        known_halo.len(),
        halo_size(width, height),
        "contour known halo length mismatch"
    );
    let paths = trace_paths(
        &add_frontier_edges(inside, known_halo, width, height),
        width,
        height,
    );
    let mut path_offsets = Vec::with_capacity(paths.len());
    let mut path_lengths = Vec::with_capacity(paths.len());
    let mut points = Vec::new();
    let mut closed = Vec::with_capacity(paths.len());
    for (path, is_closed) in paths {
        path_offsets.push((points.len() / 2) as u32);
        let closed_path = close_path(path, is_closed);
        path_lengths.push((closed_path.len() / 2) as u32);
        points.extend(closed_path.into_iter().map(|value| value as f32));
        closed.push(u8::from(is_closed));
    }

    ContourGeometry {
        abi_version: CONTOUR_GEOMETRY_ABI_VERSION,
        width: width as u32,
        height: height as u32,
        origin_x,
        origin_y,
        path_offsets,
        path_lengths,
        points,
        closed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn halo(width: usize, height: usize, value: u8) -> Vec<u8> {
        vec![value; (width + 2) * (height + 2)]
    }

    #[test]
    fn traces_a_single_cell_without_renderer_smoothing() {
        let result = prepare_contour_geometry(&[1], &halo(1, 1, 1), 1, 1, -8, 13);
        assert_eq!(result.abi_version, CONTOUR_GEOMETRY_ABI_VERSION);
        assert_eq!((result.origin_x, result.origin_y), (-8, 13));
        assert_eq!(result.path_offsets, vec![0]);
        assert_eq!(result.path_lengths, vec![5]);
        assert_eq!(result.closed, vec![1]);
        assert_eq!(
            result.points,
            vec![0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0]
        );
    }

    #[test]
    fn unknown_halo_suppresses_frontier_edges() {
        let mut known = halo(1, 1, 0);
        // Keep only the interior sample known; all four frontier neighbors remain unknown.
        known[4] = 1;
        let result = prepare_contour_geometry(&[1], &known, 1, 1, 0, 0);
        assert!(result.path_offsets.is_empty());
        assert!(result.points.is_empty());
    }

    #[test]
    fn marks_partial_frontiers_as_open_paths() {
        let width = 2;
        let height = 1;
        let mut known = halo(width, height, 0);
        // Interior plus west/east neighbors are known; north/south remain unknown.
        known[4] = 1;
        known[5] = 1;
        known[6] = 1;
        known[7] = 1;
        let result = prepare_contour_geometry(&[1, 1], &known, width, height, 0, 0);
        assert_eq!(result.closed, vec![0, 0]);
        assert_eq!(result.path_lengths, vec![2, 2]);
    }

    #[test]
    fn separated_regions_are_stable() {
        let inside = [1, 0, 1];
        let first = prepare_contour_geometry(&inside, &halo(3, 1, 1), 3, 1, 0, 0);
        let second = prepare_contour_geometry(&inside, &halo(3, 1, 1), 3, 1, 0, 0);
        assert_eq!(first.path_offsets, second.path_offsets);
        assert_eq!(first.path_lengths, second.path_lengths);
        assert_eq!(first.points, second.points);
        assert_eq!(first.closed, vec![1, 1]);
    }

    #[test]
    fn traces_a_dense_deterministic_pattern() {
        let width = 16;
        let height = 16;
        let inside: Vec<u8> = (0..height)
            .flat_map(|y| (0..width).map(move |x| u8::from((x * 13 + y * 7 + x * y) % 17 < 7)))
            .collect();
        let result =
            prepare_contour_geometry(&inside, &halo(width, height, 1), width, height, -16, 16);
        assert!(!result.path_offsets.is_empty());
        assert_eq!(result.path_offsets.len(), result.closed.len());
    }
}
