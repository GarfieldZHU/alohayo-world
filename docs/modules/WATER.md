# Water Module

**Status:** drainage and static geomorphology metadata implemented; natural contour polish
continues in issue `#41`.

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
- expose typed erosion potential, sediment load, deposition, and floodplain metadata over
  the authoritative drainage graph

## First Vertical Slice

- Extract renderer water helpers into `packages/engine/src/water-render.ts`
- Keep terrain/water edge rendering in one place
- Shape river paths deterministically before rendering
- Document the fully natural target and remaining contour work

## Geomorphology Metadata

`packages/map/src/hydrology.ts` derives four deterministic `Uint8Array` fields after
flow direction, accumulation, watershed, slope, and depression are known:

- `erosionPotential`: relative material-release risk from slope and contributing flow;
- `sedimentLoad`: bounded material currently available along the downstream path;
- `deposition`: low-slope or depression-retained material hint;
- `floodplain`: binary corridor mask near substantial drainage on sufficiently low slope.

Parameters live under `geomorphology` in `content/core/world.json`. These fields are
metadata for later terrain, roads, towns, ecology, and rendering. They do not mutate
elevation, simulate time, or claim cross-chunk sediment conservation.

## Next Slice

1. Coastline contour extraction rather than only cardinal edge blending.
2. Lake perimeter treatment distinct from ocean/sea.
3. Flow-aware river highlight direction and width variation in the renderer.
4. Distance-to-shore tinting for shallow water and beach shelves.
5. Cross-chunk watershed identity and seam-safe outlets in issue `#38`.
6. Seasonal inundation, delta growth, and persistent terrain change in the dedicated
   dynamic-geomorphology follow-up.

The cross-chunk implementation contract lives in `../CROSS_CHUNK_HYDROLOGY.md`. Keep
hydrology truth, river graph identity, and smoothed water presentation as separate layers.

## Tests

- deterministic river path shaping for the same seed/config
- chunk-border parity for water-edge rendering helpers
- generation config compatibility and schema checks
- visual smoke tests for coast, lake, and river showcase seeds
- deterministic and config-sensitive geomorphology arrays with bounded byte values
