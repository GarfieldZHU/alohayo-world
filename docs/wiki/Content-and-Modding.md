# Content and Modding

> **Wiki page version:** EN 1.1.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-23
> **中文:** [内容与模组](Content-and-Modding-zh-CN) · **Translation status:** synced with EN 1.1.0

Alohayo World is config-first. Content may select registered engine capabilities, but
JSON never executes code. Stable namespaced IDs are the language shared by terrain,
characters, items, maps, saves, localization, and future plugins.

## Content Pack Shape

A pack declares an ID, version, dependencies, file ownership, and exported content.
Dependency order is deterministic and cyclic/missing dependencies fail validation.
Authored overlays retain source-pack provenance, overlap diagnostics, and a resolution
hash suitable for save compatibility.

## Add Terrain

1. Add the stable ID and numeric definition to `content/core/biomes.json`.
2. Add real-world description, generation, surfaces, physics, and transformations to
   `content/core/terrain-rules.json`.
3. Add English and Simplified Chinese names/descriptions before UI use.
4. Update terrain/GIS/map docs and the paired Wiki pages.
5. Add deterministic generation and localization coverage.
6. Run content validation and inspect the dev terrain showcase.

Do not encode mainland, island, river, bay, or cliff as climate biomes merely because
they are visible geography. Use topology or feature overlays where appropriate.

## Add an Authored Area

Place an area JSON under `content/maps/<pack>/areas/` and register it in that pack's map
index. Prefer compact patches, shapes, entity/protected-region declarations, and generator
modifiers over listing thousands of cells. Runtime activation uses `mapAreaIds`; disabled
dev fixtures must never alter ordinary seeds.

## Add an Authored Entity

Entities are declarative anchors, not scripts. Use only registered `kind` values:
`npc-spawn`, `enemy-spawn`, `merchant-spawn`, `resource-node`, or `quest-marker`.
`respawnPolicy` is `on-chunk-revisit` by default and may be `never` for a persistent
one-time entity. The content validator rejects unknown kinds, invalid policies, and
executable-shaped fields. Read [Authored Entity Lifecycle](../AUTHORED_ENTITY_LIFECYCLE.md)
before adding behavior, persistence, or renderer views.

## Add Character or Equipment Content

1. Add localization keys first.
2. Extend abilities, roles, archetypes, appearance pools, slots, items, or rules catalogs.
3. Reference terrain and capability tags by stable ID.
4. Keep players, NPCs, and enemies on the same definition model.
5. Validate requirements, pools, slot compatibility, and deterministic generation.
6. Keep optional derived logic in the pure `character-rules` package.

## Compatibility Rules

- Prefer additive stable IDs; deleting or repurposing an ID requires save migration.
- Pack merge order and conflicts must be explicit and deterministic.
- Visible strings live in `i18n/`, never inline in engine code.
- Assets require original/CC0 provenance and `assets/ATTRIBUTION.json` registration.
- Configuration can choose registered behavior; it cannot contain JavaScript or Rust code.
- A pack must not infer terrain physics from translated names, palette colors, or sprites.

## Useful Commands

```bash
yarn validate:content
yarn validate:assets
yarn validate:wiki
yarn test
yarn build
```

Read `docs/CONTENT_GUIDE.md`, `docs/CONTENT_PACKS.md`, `docs/config/MAPS.md`, and the
nearest `AGENTS.md` before changing executable content.
