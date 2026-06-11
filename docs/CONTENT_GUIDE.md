# Content Guide

Content lives under `content/<pack-id>` and begins with `manifest.json`.

- `world.json`: seed defaults, dimensions, chunk size, generator and starting position.
- `biomes.json`: ordered climate/elevation rules and painterly palette.
- Future `entities.json`: component values, appearance and interaction tags.
- Future `modes.json`: registered systems, panels, input map and goals.

IDs are lowercase kebab-case and globally namespaced by pack. References must resolve
inside declared dependencies. Run `yarn validate:content` after every change.

To add a biome, append a definition with a unique numeric code, color, climate ranges,
movement cost, and description. To add a map pack, copy the example pack, change its ID,
declare its dependency on `core`, and provide a world definition or authored overlay.
