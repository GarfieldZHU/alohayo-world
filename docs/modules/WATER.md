# Water Module

**Status:** foundation planned; first renderer and river-shaping slice started.

## Owns

Water-specific shape logic and rendering language above the base terrain/topology model:

- sea and ocean shoreline bands
- lake perimeter treatment
- river centerline shaping and bank rendering
- water surface direction cues
- later deltas, estuaries, marsh outlets, waterfalls, and drainage visuals

## Dependencies

- `modules/MAP.md` for topology, hydrology, chunk queries, and deterministic generation
- `modules/WEATHER.md` for wetness, snow, mud, and reflective overlays
- `modules/ROADS.md` for bridges, fords, ferries, and shoreline crossings

## Public Capabilities

- classify whether a visible boundary is open sea, shallow shelf, lake edge, or river bank
- render shoreline bands and foam/highlight passes from stable shape hints
- render river curves with width, flow emphasis, and bank color
- expose streaming-safe refresh hooks for seam-adjacent water geometry

## First Vertical Slice

- Extract renderer water helpers into `packages/engine/src/water-render.ts`
- Keep terrain/water edge rendering in one place
- Shape river paths deterministically before rendering
- Document the fully natural target and remaining contour work

## Next Slice

1. Coastline contour extraction rather than only cardinal edge blending.
2. Lake perimeter treatment distinct from ocean/sea.
3. Flow-aware river highlight direction and width variation.
4. Distance-to-shore tinting for shallow water and beach shelves.
5. Basin/drainage-aware lake generation and outlet hints.

## Tests

- deterministic river path shaping for the same seed/config
- chunk-border parity for water-edge rendering helpers
- generation config compatibility and schema checks
- visual smoke tests for coast, lake, and river showcase seeds
