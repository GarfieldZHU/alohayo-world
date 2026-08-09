//! Typed-array batch outputs crossing the Rust/Wasm boundary.
//!
//! Each vector is owned by the returned Wasm object. The worker validates lengths before
//! using it and transfers the JS typed-array buffers back to the engine.

use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkBaseLayers {
    pub elevation: Vec<u8>,
    pub moisture: Vec<u8>,
    pub temperature: Vec<u8>,
}

#[wasm_bindgen(getter_with_clone)]
pub struct HydrologyCoreRaster {
    pub width: u32,
    pub height: u32,
    pub raw_elevation: Vec<f32>,
    pub filled_elevation: Vec<f32>,
    pub water: Vec<u8>,
    pub slope: Vec<u8>,
    pub flow_direction: Vec<i8>,
    pub flow_accumulation: Vec<u32>,
    pub watershed: Vec<u32>,
    pub depression: Vec<u8>,
}

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkRenderHints {
    pub noise: Vec<u32>,
    pub east_boundary_mask: Vec<u8>,
    pub south_boundary_mask: Vec<u8>,
    pub regional_detail_mask: Vec<u8>,
    pub close_detail_kind: Vec<u8>,
    pub detail_offset_x: Vec<u8>,
    pub detail_offset_y: Vec<u8>,
    pub shore_distance: Vec<i8>,
}

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkTerrainTextureHints {
    /// High nibble is a stable biome-derived recipe family; low nibble is density.
    pub pattern: Vec<u8>,
}

/// Deterministic, renderer-independent frontier paths produced by the contour batch.
///
/// `points` is a flattened `x, y` stream in chunk-local cell-corner coordinates. Each
/// path starts at `path_offsets[index]` points and contains `path_lengths[index]` points;
/// a closed path repeats its first point at the end. `closed` is `1` for closed paths and
/// `0` for open paths. All buffers are owned by the returned Wasm object and are copied
/// into JavaScript typed arrays by wasm-bindgen; callers may transfer those buffers to a
/// worker consumer after reading them. Rust never retains references to input buffers.
#[wasm_bindgen(getter_with_clone)]
pub struct ContourGeometry {
    /// ABI version for this coarse geometry contract.
    pub abi_version: u32,
    /// Input raster width and height in cells.
    pub width: u32,
    pub height: u32,
    /// World-space origin associated with these chunk-local paths.
    pub origin_x: i32,
    pub origin_y: i32,
    /// Number of points in each path, not number of scalar floats.
    pub path_offsets: Vec<u32>,
    pub path_lengths: Vec<u32>,
    /// Flattened `x, y` point pairs. Coordinates stay chunk-local by design.
    pub points: Vec<f32>,
    /// `1` for a closed path, `0` for an open path.
    pub closed: Vec<u8>,
}
