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

- Fog now uses a fill-plus-cutout model backed by a continuous visibility field, which
  is materially better than painting dark hidden cells directly.
- Coastline blending now crosses loaded chunk borders.
- Rivers now support a shaped path before rendering, and water rendering logic has been
  extracted into `packages/engine/src/water-render.ts`.

The first contour slice now traces deterministic water-mask frontiers into smoothed
typed-array paths, renders layered shore/shelf/foam strokes, and refreshes loaded cardinal
neighbors when a streamed seam gains context. Discovery fog now adaptively subdivides only
cells crossed by the continuous visibility field, producing a gradual frontier without
paying sub-cell draw cost across the whole retained world. Per-chunk blur filters were
removed after they proved to sample transparent pixels beyond each finite chunk and expose
bright horizontal/vertical seams. The current renderer keeps chunk masks unfiltered and
uses the global screen-space vision layer for the soft active boundary.

This is now a coherent continuous-shape renderer. Worker render hints still carry the
deterministic local shoreline field, while the retained renderer rebuilds its signed field
from a one-cell loaded-neighbor halo whenever a seam gains context. Unknown samples remain
unknown, so load order cannot invent a coast. Water presentation classifies deep ocean,
ocean shelf, beach, cliff, lake bank, estuary, delta, marsh, and reef materials from stable
biome, distance, slope, river, deposition, and floodplain hints.

Discovery fog is packed into one BGRA texture over the rendered neighborhood and composed
by PixiJS on the GPU. The texture samples the same world-space visibility function as the
CPU action reference, interpolates discovered memory between cell centers, and updates only
the union of the previous and current vision envelopes during travel. A two-samples-per-cell
texture with linear GPU filtering preserves the soft frontier without the cost of uploading
per-cell Graphics geometry.

## Fog Compositing Architecture

Chunk boundaries are storage and streaming boundaries, never visual boundaries. Do not
attach blur, glow, displacement, or other neighborhood-sampling filters to an isolated
chunk mask: every such filter needs samples outside that chunk and will otherwise clamp or
sample transparency at the edge.

Translucent discovery fog is accumulated into one world-space `Graphics` layer across all
rendered chunks. Chunk-local data still drives incremental discovery, but chunks no longer
own independently composited fog surfaces. Blanket primitive overscan is forbidden because
it turns every cell edge into a dark grid; feathering belongs in the global composite, not
overlapping CPU primitives.

Visibility noise and distance are evaluated in world coordinates. Chunk-local coordinates
remain valid for buffer lookup only; using them as a procedural-noise phase resets the fog
field at every chunk origin and exposes a vertical/horizontal separator even when geometry
coverage is correct.

The same rule applies to shoreline topology. A missing streamed neighbor is `unknown`,
not land. Contour extraction therefore accepts a known-sample predicate and suppresses
frontier segments where the neighboring sample is unavailable. Once that chunk arrives,
the existing cardinal-neighbor refresh draws the real coast, lake bank, or continuous
water surface. This tri-state contract (`water`, `land`, `unknown`) must survive any future
worker/Wasm contour batch as an explicit known-data mask or halo.

The production implementation completed in issue `#41` follows this split:

1. Map code owns the one-cell halo shoreline field; worker/Wasm owns the initial typed
   render-hint batch and keeps a byte-identical TypeScript fallback.
2. Engine preparation packs discovered and active-visibility alpha into one coarse typed
   pixel buffer for the retained rendered neighborhood.
3. PixiJS/WebGL owns one filtered BGRA mask texture across that neighborhood.
4. Texture alpha applies hidden, explored, current-vision, and feathered mist values
   without knowing chunk borders.
5. Gameplay legality continues to query the CPU visibility field; the shader is
   presentation only.

Wasm does not issue draw calls or own GPU resources. The render-hint Wasm candidate remains
capability-gated, with TypeScript fallback; contour segment promotion remains isolated in
its dedicated measurement track.

## Fully Natural Plan

### 1. Fog contour generation

Continue replacing per-cell cutouts with contour extraction from discovered/hidden masks.
The current first slice already renders a connected, feathered visibility field and uses
the same continuous sample for discovery reveal.

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

### Stage A: foundation (partially implemented)

- Keep the current extracted `water-render.ts` helper as the renderer boundary.
- Keep map-side river shaping deterministic and config-driven.
- Add explicit water-shape configuration values before adding new visuals.
- Emit a worker-safe signed local shoreline field and consume it only as a subtle
  water-material band. This is implemented; it must not be promoted to seam authority.

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
