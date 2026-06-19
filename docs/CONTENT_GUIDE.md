# Content Guide

Read the nearest `content/AGENTS.md` before editing definitions. Public TypeScript
contracts live in `packages/config`; this guide explains author intent.

## World sizes

`WorldDefinition.sizePresets` declares bounded finite-demo choices. Presets must remain
within runtime limits (`64 x 48` through `384 x 288`) until chunk streaming replaces
whole-world generation and drawing.

## Geographic definitions

Visible terrain definitions provide stable numeric codes, names, colors, movement
costs, and descriptions. Physical fields and topology are generated data and must not
be duplicated as fake biome combinations such as `mainland-forest`.

To add terrain:

1. reserve a stable code and namespaced ID;
2. update classification in `packages/map`;
3. add color and movement data in `content/core/biomes.json`;
4. document the geographic meaning and precedence;
5. validate content and deterministic output.

Content lives under `content/<pack-id>` and begins with `manifest.json`.

- `world.json`: seed defaults, dimensions, chunk size, generator and starting position.
- `biomes.json`: ordered climate/elevation rules and painterly palette.
- Future `entities.json`: component values, appearance and interaction tags.
- Future `modes.json`: registered systems, panels, input map and goals.

IDs are lowercase kebab-case and globally namespaced by pack. References must resolve
inside declared dependencies. Run `yarn validate:content` after every change.

To add a biome, append a definition with a unique numeric code, family, palette, climate
ranges, movement cost, road cost, occurrence weight, creature habitat tags, and
settlement suitability. Those metadata drive transport and population generation, not
just rendering.

Custom authored areas live under `content/maps/**/areas/` and are discovered
automatically at build time. See `config/MAPS.md`.

Characters live under `content/characters/` as separate ability, appearance, slot,
item, pool, and archetype catalogs. See `config/CHARACTERS.md`.
