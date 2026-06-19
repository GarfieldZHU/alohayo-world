# Content Agent Guide

Content configures registered capabilities and contains no executable code.

- Validate every committed definition.
- Use `namespace:name` IDs and stable numeric terrain codes.
- Keep `biomes.json`, `terrain-rules.json`, and English/Chinese i18n biome names
  synchronized for every visible terrain.
- Prefer adding definitions over branching engine code.
- Include a minimal example for new schema features.
- Record generator/schema version effects on determinism and saves.
- Run `yarn validate:content`.
