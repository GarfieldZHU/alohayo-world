# Water Module

**Status:** drainage/static geomorphology and the issue `#41` natural-rendering pass are
implemented; persistent terrain change continues in issue `#44`.

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
- distinguish known land/water samples from unknown streamed frontiers so unloaded chunks
  never become synthetic straight coastlines
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

Issue `#44` Phase 0 now adds an optional map-side active-corridor kernel over these fields.
It uses explicit integer state and exact water/sediment accounting, emits sparse changed
cells and provisional local outlet exports, and stays disabled by default. See
`../DYNAMIC_GEOMORPHOLOGY.md`. Cross-chunk persistence remains blocked on canonical `#38`
drainage identities.

## Natural Rendering Baseline

1. Smoothed shoreline contours suppress unknown streamed frontiers and refresh only loaded
   cardinal seams.
2. A signed distance field consumes a one-cell loaded-neighbor halo and drives distinct
   ocean shelf, beach, cliff, lake-bank, estuary, delta, marsh, and reef materials.
3. Rivers widen downstream and layer banks, water, and directional highlights.
4. Discovery fog is one filtered GPU texture with world-space visibility parity and
   vision-union dirty updates.
5. Persistent seasonal inundation, erosion, channel migration, and delta growth remain
   simulation work in issue `#44`, not renderer-owned state.

The cross-chunk implementation contract lives in `../CROSS_CHUNK_HYDROLOGY.md`. Keep
hydrology truth, river graph identity, and smoothed water presentation as separate layers.

## Tests

- deterministic river path shaping for the same seed/config
- chunk-border parity for water-edge rendering helpers
- generation config compatibility and schema checks
- visual smoke tests for coast, lake, and river showcase seeds
- CPU/GPU fog action-threshold parity and dirty-update/full-rebuild byte parity
- desktop/mobile browser budgets and screenshot review at normal game zoom
- deterministic and config-sensitive geomorphology arrays with bounded byte values
