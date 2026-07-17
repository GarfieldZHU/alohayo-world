# Custom Map Area Configuration

For pack dependency rules, merge order, provenance, and future overlay families, read
`../CONTENT_PACKS.md` before changing this format.

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

Disabled files are still validated and bundled. They are useful for development fixtures
or optional scenarios and can be activated by launchers through
`initialWorld.mapAreaIds`, for example `core:terrain-showcase`.

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

## Authored Entities

`entities` define deterministic runtime anchors for actors, props, encounters, portals,
or spawns. The current explorer renders them through the inspectable landmark layer;
actor lifecycle and respawn policy remain a separate gameplay capability.

```json
{
  "id": "archipelago:cloudbreak-scout",
  "kind": "npc-spawn",
  "x": 10,
  "y": 7,
  "archetypeId": "core:wayfinder",
  "factionId": "archipelago:cloudbreak-watch",
  "tags": ["spawn", "coastal", "demo"],
  "notes": "Reserved for the future authored entity runtime slice."
}
```

Rules:

- `id` must stay stable and namespaced.
- `kind` is a data tag, not executable behavior.
- `x` and `y` are local area-cell coordinates inside the area bounds.
- `archetypeId`, `factionId`, `tags`, and `notes` are optional metadata for loaders and
  tooling.

## Protected Regions

`protectedRegions` define local bounds the generator or later overlay systems should
leave alone unless an explicit override policy is introduced.

```json
{
  "id": "archipelago:cloudbreak-lagoon-core",
  "x": 4,
  "y": 3,
  "width": 10,
  "height": 8,
  "shape": "ellipse",
  "reason": "Preserve the inner lagoon ring during future runtime overlay passes.",
  "blocks": ["terrainPatches", "modifiers"]
}
```

Rules:

- `shape` currently supports `rectangle` and `ellipse`.
- bounds must stay completely inside the local area rectangle.
- `blocks` must be chosen from `terrainPatches`, `cells`, `landmarks`, `entities`,
  `modifiers`, `settlements`, `roads`, or `rivers`.
- protection is order-sensitive: a region blocks later authored areas, while procedural
  settlements, roads, and rivers are always considered later than authored content.
- a region never erases content from its own area. Put a reserve area before another
  authored area when its purpose is to suppress that later overlay.

## Generator Modifiers

`modifiers` are local hints for settlement, road, ecology, or authored-scenario passes.
Keep them descriptive and deterministic.

```json
{
  "id": "archipelago:cloudbreak-harbor-bias",
  "kind": "settlement-bias",
  "x": 6,
  "y": 5,
  "width": 5,
  "height": 4,
  "shape": "ellipse",
  "strength": 0.42,
  "parameters": {
    "role": "harbor",
    "roadBias": 0.25
  },
  "tags": ["future-settlement", "lagoon-edge"],
  "notes": "Example local generator hint for the next authored-overlay runtime slice."
}
```

Rules:

- modifiers are data only; `kind` selects a registered capability.
- `strength` is numeric and deterministic, not an imperative script.
- `parameters` may contain only scalar JSON values.
- bounds must stay fully inside the authored area.

The first registered capability is `settlement-bias`. Its strengths combine and clamp
to `[-1, 1]`; the result adjusts procedural site suitability without directly spawning
a settlement. Unknown kinds remain validated inert data so packs can be forward
compatible without executing arbitrary code.

## Adding a Pack

1. Create `content/maps/<pack>/areas/`.
2. Add one small area JSON copied from the example.
3. Use namespaced IDs owned by the pack.
4. Reference existing terrain IDs or add validated terrain definitions first.
5. Add an optional `index.json` listing the area's intended order and purpose.
6. Run validation, deterministic tests, build, and E2E.

Use `"enabled": false` for dev/test fixtures. Do not globally enable a showcase or
benchmark area unless it is intended to appear in normal generated worlds.

## Current Limits

- Areas are finite rectangular local coordinate spaces.
- Patches support rectangles, ellipses, and exact cells.
- Files are bundled at build time, not downloaded dynamically.
- Cross-pack dependency resolution and runtime content downloads remain `v0.2` work.

The authored-overlay runtime validates and resolves landmarks, entities, protected
regions, and generator modifiers into world coordinates with provenance. Actor
lifecycle, conflict visualization, and additional registered modifier consumers remain
follow-up modules rather than ad hoc schema growth.
