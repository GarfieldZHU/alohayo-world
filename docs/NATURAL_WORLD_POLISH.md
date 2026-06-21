# Natural World Polish

This document defines the next quality bar after the current prototype-friendly blended
terrain renderer. The goal is not simply "more effects"; it is to make the world read as
continuous geography first and a cell simulation second.

## Target Qualities

1. Fog of war reads as a continuous mist field, not repeated cell shapes.
2. Sea, coast, beach, river, and lake edges read as natural contours, not stair-stepped
   adjacency.
3. Water surfaces communicate direction, depth, and shoreline type.
4. Game mode hides grid logic by default; cell structure is for simulation and dev tools.
5. Streaming keeps visual continuity across chunk borders without expensive full-world
   mesh rebuilds.

## Current Baseline

- Fog now uses a fill-plus-cutout model, which is materially better than painting dark
  hidden cells directly.
- Coastline blending now crosses loaded chunk borders.
- Rivers now support a shaped path before rendering, and water rendering logic has been
  extracted into `packages/engine/src/water-render.ts`.

This is good prototype quality, but it is still fundamentally cell-derived.

## Fully Natural Plan

### 1. Fog contour generation

Replace per-cell rounded cutouts with contour extraction from discovered/hidden masks.

- Input: chunk-local discovery mask with one-cell neighbor lookups.
- Method: marching squares or dual contour extraction over the discovered frontier.
- Output: smooth revealed polygon plus optional feathered hidden-side falloff.
- Render rule: softness should bias toward the mist side, not eat into the visible area.

### 2. Coastline contour generation

Replace cardinal neighbor blending with water/land contour bands.

- Input: local water mask plus one-cell cross-chunk neighbors.
- Method: contour extraction for coastline edges, then derive beach band, foam band, and
  shallow-water tint from distance to shore.
- Output: one coherent shoreline shape per chunk section instead of repeated edge strips.

### 3. Unified water shape module

Create a shared map/engine contract for water shapes:

- ocean shelf edges
- lake perimeters
- river centerlines
- river banks
- deltas and marsh outlets later

The long-term split is:

- `packages/map`: deterministic hydrology and shape hints
- `packages/engine`: contour smoothing, bank/foam/sheen rendering, and LOD

### 4. Water direction and surface language

Water should communicate flow and containment:

- oceans and seas: broad glints and directional current streaks
- lakes: calmer enclosed sheen with less directional bias
- rivers: clear downstream ribbons, bank shading, and width variation
- wetlands/marsh: broken reflective patches instead of open-water sheen

### 5. Streaming-safe continuity

Natural rendering must survive streamed generation:

- contour extraction may use neighbor chunk samples when available
- missing frontier neighbors should degrade gracefully
- when a neighboring chunk arrives, only local seam-adjacent geometry should refresh

## Implementation Stages

### Stage A: foundation

- Keep the current extracted `water-render.ts` helper as the renderer boundary.
- Keep map-side river shaping deterministic and config-driven.
- Add explicit water-shape configuration values before adding new visuals.

### Stage B: contour frontier

- Build chunk-local coastline and fog frontier masks.
- Generate smoothed polylines/polygons from masks.
- Re-render seam-adjacent chunks when neighbor data becomes available.

### Stage C: hydrology refinement

- Add drainage direction and accumulation.
- Make lakes basin-aware instead of connectivity-only.
- Generate lake inflow/outflow hints and more reliable river mouths.

### Stage D: visual refinement

- Add shallow-water shelf tinting based on distance to shore.
- Add lake-specific border treatment.
- Add river-bank textures and directional highlights.
- Add delta, estuary, and marsh outlet handling.

## Acceptance Bar

- At normal game zoom, the player reads terrain masses, shorelines, and fog boundaries as
  continuous shapes.
- Rivers feel guided by terrain rather than drawn on top of it.
- Chunk borders do not create obvious shoreline seams after neighbors load.
- Dev mode may still expose the grid; game mode should not look grid-authored.
