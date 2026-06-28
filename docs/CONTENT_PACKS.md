# Content Packs and Authored Overlays

This document turns issue `#7` into a repository-level implementation plan. Read it
with `CONTENT_GUIDE.md`, `MAP_SYSTEM.md`, `config/MAPS.md`, and `modules/MAP.md`.

## Goal

Allow new world content to plug into the game as versioned packs, validate dependency
rules, merge authored overlays deterministically, and prove that packs can extend the
world without changing engine code.

The immediate target is local, bundled packs discovered at build time. Runtime
downloads, signed distribution, and in-game pack browsers are later work.

## Current Baseline

The repository already has the first shape of a pack contract:

- `ContentPackManifest` declares `id`, `version`, `dependencies`, and optional content
  entry files.
- `content/maps/**/areas/*.json` are discovered automatically.
- `initialWorld.mapAreaIds` can enable optional authored areas such as the terrain
  showcase.
- Procedural generation runs first and authored map areas apply after classification.

What is still missing is the full pack-loader model around dependency ordering,
conflict rules, migrations, diagnostics, and extension proofs.

## Pack Model

Each pack is a data-only extension unit rooted at `content/<pack-id>/`.

Expected structure over time:

```text
content/<pack-id>/
  manifest.json
  world.json
  biomes.json
  terrain-rules.json
  maps/
    index.json
    areas/*.json
  characters/
    index.json
    *.json
  entities/
    index.json
    *.json
```

Not every pack needs every file. A small overlay pack may only contribute authored
areas and landmarks.

## Loader Responsibilities

The content-pack loader should own five responsibilities:

1. discover pack manifests and referenced files;
2. validate the dependency graph and schema versions;
3. build a deterministic load order;
4. merge pack contributions into runtime-ready manifests;
5. expose provenance and conflicts for tooling, tests, and future saves.

The engine should consume resolved content, not raw pack directories.

## Deterministic Load Order

Pack order must never depend on host filesystem quirks.

Resolution rules:

1. sort manifests by pack ID before graph work for deterministic tie-breaking;
2. build a directed acyclic graph from `manifest.dependencies`;
3. fail validation on missing dependencies or cycles;
4. topologically sort packs;
5. within the same dependency depth, fall back to lexicographic pack ID;
6. within a pack, keep stable file ordering by relative path.

The resolved pack order becomes part of the world/content hash.

## Overlay Merge Model

Procedural terrain remains the base layer. Packs contribute overlays above it.

Overlay merge order:

1. base generator fields and terrain classification;
2. core pack defaults;
3. dependency packs in resolved order;
4. leaf pack authored areas and patch files;
5. launcher-selected optional overlays such as `initialWorld.mapAreaIds`;
6. future transient runtime overlays such as discovery, weather surfaces, and quests.

Merge policy by data kind:

- world defaults: one authoritative source, normally `core`;
- biome and terrain rules: additive by stable ID, fail on duplicate ID unless an
  explicit override contract exists;
- authored map areas: additive collections, with deterministic patch application;
- terrain/cell patches: later overlay wins for the same target cell;
- landmarks/entities: additive by ID, fail on duplicate stable IDs;
- protected regions/portals: additive, but must validate references and bounds.

The important part is that override behavior is explicit and small. Silent replacement
should be rare.

## Authored Overlay Types

Issue `#7` should grow overlays in controlled layers instead of one giant schema.

Planned overlay families:

- `terrainPatches`: broad rectangles and ellipses for land/water/ecology shaping;
- `cells`: exact surgical overrides;
- `landmarks`: named map features and later spawn anchors;
- `entities`: authored actors, props, portals, or encounter seeds;
- `protectedRegions`: zones the generator or later systems should not overwrite;
- `modifiers`: local generator hints such as settlement bias or road bias.

The current implementation only has the first three. The next slice should add schemas
for the later families before engine behavior depends on them.

## Dependency and Compatibility Rules

Dependency meaning should stay simple:

- a pack may depend only on declared pack IDs;
- dependency packs load before dependents;
- a dependent pack may reference stable IDs exported by its dependencies;
- packs must declare a schema version and content version independently;
- future saves must record the resolved pack set plus versions.

Compatibility gates:

- schema incompatibility is a hard validation error;
- missing referenced IDs are hard validation errors;
- duplicate exported IDs are hard validation errors unless an explicit override field
  and policy are introduced;
- optional packs remain disabled unless explicitly enabled by the launcher or a preset.

## Migration Strategy

Two migration tracks matter here:

1. content schema migration, for pack files themselves;
2. save compatibility migration, for saved worlds referencing a pack set.

For `v0.2`, keep it modest:

- keep `schemaVersion: 1` authoritative;
- define migration hooks and registry shape in docs first;
- require any future `schemaVersion: 2+` work to ship with fixtures and deterministic
  parity tests;
- keep unresolved migrations as load-time hard failures rather than partial repair.

Issue `#11` already covers save migrations; issue `#7` should focus on pack-resolution
metadata that saves will later consume.

## Validation and Tooling

The loader should eventually produce a validation report with:

- resolved pack order;
- dependency graph;
- duplicate ID conflicts;
- missing references;
- optional overlays enabled by default or launcher selection;
- authored area bounds and overlap warnings;
- world hash contribution summary.

This report is for CI first and a dev inspector later.

## Vertical Slices

### Slice A: dependency-safe bundled packs

Goal: prove pack discovery, dependency ordering, and deterministic merge without remote
loading.

Deliver:

- manifest discovery and graph validation;
- deterministic pack order;
- merged authored areas from multiple packs;
- one example dependent pack proving extension without engine edits;
- tests for missing dependency, cycle, duplicate ID, and stable hash behavior.

### Slice B: richer authored overlays

Goal: extend area files from terrain patches into reusable authored geography content.

Deliver:

- schemas for landmarks, entities, protected regions, and generator modifiers;
- pack-aware provenance recorded per overlay;
- map queries that can report the winning overlay and source pack.

### Slice C: migration and diagnostics

Goal: make pack growth survivable for future saves and debugging.

Deliver:

- migration registry shape;
- validation report contract;
- overlay conflict inspector plan and CI surface.

## TODO Checklist

- [ ] document and lock the deterministic dependency resolution rules in config tests
- [ ] add pack-discovery and dependency-graph validation to the content pipeline
- [ ] extend manifest/docs with the exact optional file ownership rules
- [ ] define authored overlay provenance and conflict policy by data type
- [ ] add schemas for authored entities, protected regions, and generator modifiers
- [ ] add a dependent example pack that extends `core` without engine code changes
- [ ] add deterministic tests for dependency order, conflicts, and world-hash stability
- [ ] surface loader diagnostics for CI and dev tooling
- [ ] define the migration registry shape for future schema versions
- [ ] connect pack-resolution metadata to the future save format under issue `#11`

## Out of Scope for This Slice

- runtime downloading from arbitrary URLs
- executable scripting inside packs
- networked mod sharing or multiplayer synchronization
- in-browser pack editors
- silent conflict resolution that hides authoring mistakes

## References

- `docs/CONTENT_GUIDE.md`
- `docs/MAP_SYSTEM.md`
- `docs/config/MAPS.md`
- `docs/modules/MAP.md`
- `packages/config/src/index.ts`
- GitHub issue `#7`
