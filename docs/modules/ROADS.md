# Roads Module

**Status:** active foundation.

## Owns

Road tier definitions, inter-settlement connection rules, path smoothing, terrain-aware
road surfacing, movement bonuses on roads, and future road-condition interaction with
weather.

## Current Slice

- deterministic settlement connection graph;
- four road tiers: trail, road, trade route, and pass;
- content-tuned widths, colors, and movement multipliers;
- curved road geometry built from smoothed pathfinding output;
- terrain-aware road texturing and deterministic dry/wet/muddy/snowy/slushy/flooded
  conditions shared with weather;
- condition-tuned movement and traffic multipliers from `content/core/world.json`.

## Middle-Age Magic World Guidance

- `trail`: footpaths, hunter tracks, shrine approaches, village connectors;
- `road`: packed-earth local roads between villages, forts, and towns;
- `trade-route`: broad maintained roads for caravans, royal couriers, and high traffic;
- `pass`: stony mountain or canyon crossings where grade matters more than width.

The setting should read as pre-industrial and hand-built: packed earth, gravel, timber
corduroy through wet land, snow-packed traces in winter, and stone reinforcement in
passes or major routes.

## Next Work

- explicit bridges, ferries, causeways, and switchbacks;
- settlement traffic and route choice consuming the existing condition multipliers;
- city-street interiors and paving quality;
- vehicles and mounts consuming the same road-profile queries.
