# Content Guide

Read the nearest `content/AGENTS.md` before editing definitions. Public TypeScript
contracts live in `packages/config`; this guide explains author intent. For pack loading,
dependency rules, and authored overlay merge policy, also read `CONTENT_PACKS.md`.

## World sizes

`WorldDefinition.sizePresets` declares bounded finite-demo choices. Presets must remain
within runtime limits (`64 x 48` through `384 x 288`) until chunk streaming replaces
whole-world generation and drawing.

## Geographic definitions

Visible terrain definitions provide stable numeric codes, names, colors, movement
costs, and descriptions. Terrain material behavior, generation notes, surface effects,
physics, hazards, entry requirements, and transformations live in
`content/core/terrain-rules.json`; see `TERRAIN_RULES.md`. Physical fields and topology
are generated data and must not be duplicated as fake biome combinations such as
`mainland-forest`.

To add terrain:

1. reserve a stable code and namespaced ID;
2. update classification in `packages/map`;
3. add color and movement data in `content/core/biomes.json`;
4. add material/physics rules in `content/core/terrain-rules.json`;
5. add English and Chinese names in `i18n/`;
6. document the geographic meaning and precedence;
7. validate content and deterministic output.

Content lives under `content/<pack-id>` and begins with `manifest.json`.

- `world.json`: seed defaults, dimensions, chunk size, generator and starting position.
- `world.json`: seed defaults, dimensions, chunk size, streamed runtime, road profiles,
  road-generation thresholds, and basic weather-cycle parameters.
- `biomes.json`: ordered climate/elevation rules and painterly palette.
- `terrain-rules.json`: material behavior, surface effects, physical hazards, entry
  requirements, and destruction/transformation rules.
- Future `entities.json`: component values, appearance and interaction tags.
- Future `modes.json`: registered systems, panels, input map and goals.

IDs are lowercase kebab-case and globally namespaced by pack. References must resolve
inside declared dependencies. Run `yarn validate:content` after every change.

Pack manifests and authored overlays are deterministic loader inputs, not loose metadata.
If a pack introduces a new dependency, exported ID, or overlay family, document the
change in `CONTENT_PACKS.md` and add or update fixtures proving the resolved pack order
and merge behavior.

To add a biome, append a definition with a unique numeric code, family, palette, climate
ranges, movement cost, road cost, occurrence weight, creature habitat tags, and
settlement suitability. Those metadata drive transport and population generation, not
just rendering.

Road tuning lives in `content/core/world.json`:

- `roads.profiles`: per-tier movement multiplier, width, palette, and texture strength;
- `roads.generation`: traffic thresholds, pass ruggedness threshold, candidate distance,
  smoothing iterations, and texture sampling step.

Basic weather tuning also lives in `world.json`:

- `weather.states`: ordered deterministic states such as clear, rain, snow, and thaw;
- `weather.cycleSeconds` and `transitionSeconds`: pacing and fade behavior;
- `weather` values should add visual surface behavior first and only later expand into
  full simulation effects on movement, roads, and cities.

Day/night tuning also lives in `world.json`:

- `dayNight.dayLengthMinutes`: real-time minutes per full in-game day;
- `dayNight.fixedHour`: default manual inspection hour, mapped onto the dev-mode light slider;
- `dayNight.phases`: ordered hour keyframes with darkness and tint values;
- `dayNight.moonlight`: optional night readability modifier with `tint`, `strength`, and
  `midnightLift`;
- `dayNight.sampleCount`: horizontal gradient samples used to shade the wrapped world.

Treat day/night as a wrapped east-west lighting band over the world circumference, not a
camera-local flashlight effect. Future seasons may alter phase timing, but the clock
still remains deterministic from `(seed, runtime time, world width)`.

Custom authored areas live under `content/maps/**/areas/` and are discovered
automatically at build time. See `config/MAPS.md`.

Characters live under `content/characters/` as separate ability, appearance, slot,
item, pool, and archetype catalogs. See `config/CHARACTERS.md`.
