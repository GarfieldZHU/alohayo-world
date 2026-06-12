# Custom Map Area Configuration

## How Areas Plug Into the World

The procedural generator creates elevation, climate, terrain, and topology first. It
then applies every enabled JSON file under:

```text
content/maps/<pack>/areas/*.json
```

The worker applies files in stable path order, recalculates land/water topology, records
an authored-area ID per affected cell, adds landmarks, and includes the result in the
world hash. Adding an area file requires no code change.

Later files may overwrite cells from earlier files. Use that intentionally for small
detail packs; avoid overlapping unrelated areas.

## Minimal Area

```json
{
  "schemaVersion": 1,
  "id": "my-pack:green-isle",
  "name": "Green Isle",
  "description": "An authored island.",
  "enabled": true,
  "placement": { "mode": "normalized", "x": 0.7, "y": 0.2 },
  "width": 20,
  "height": 14,
  "terrainPatches": [
    {
      "shape": "ellipse",
      "x": 0,
      "y": 0,
      "width": 20,
      "height": 14,
      "terrainId": "core:coast",
      "elevation": 118
    },
    {
      "shape": "ellipse",
      "x": 3,
      "y": 2,
      "width": 14,
      "height": 10,
      "terrainId": "core:grassland",
      "elevation": 145
    }
  ]
}
```

## Placement

- `absolute`: `x` and `y` are world-cell coordinates.
- `normalized`: `x` and `y` are values from `0` to `1`, positioning the area's
  top-left corner within the remaining world extent.

Normalized placement keeps an area in roughly the same geographic region across Large,
Huge, and Continental maps. Absolute placement is appropriate for fixed scenarios.

## Terrain Patches

Patches are ordered paint operations local to the area:

- `rectangle`: fills the complete patch bounds.
- `ellipse`: fills cells whose centers fall inside the ellipse.
- `terrainId`: must reference a registered terrain such as `core:forest`.
- `elevation`, `moisture`, `temperature`: optional `0..255` physical-field overrides.

Use broad water/coast patches first, then land cover, highlands, and small features.
This creates readable nested geography.

## Cell Patches

`cells` are precise local overrides applied after broad patches:

```json
{
  "x": 8,
  "y": 5,
  "terrainId": "core:bare-rock",
  "elevation": 210
}
```

Use cells for entrances, peaks, crossings, clearings, and hand-tuned edges. Avoid
listing thousands of cells; add a new patch shape or external authored format when
detail becomes large.

## Landmarks

Landmarks are local coordinates with stable IDs, names, kinds, and descriptions. The
demo renders a marker at regional zoom. Future systems use the same definitions for
spawns, portals, quests, settlements, and map labels.

## Adding a Pack

1. Create `content/maps/<pack>/areas/`.
2. Add one small area JSON copied from the example.
3. Use namespaced IDs owned by the pack.
4. Reference existing terrain IDs or add validated terrain definitions first.
5. Add an optional `index.json` listing the area's intended order and purpose.
6. Run validation, deterministic tests, build, and E2E.

## Current Limits

- Areas are finite rectangular local coordinate spaces.
- Patches support rectangles, ellipses, and exact cells.
- Files are bundled at build time, not downloaded dynamically.
- Cross-pack dependency resolution and runtime content downloads remain `v0.2` work.
