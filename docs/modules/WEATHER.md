# Weather Module

**Status:** deterministic surface-and-condition foundation active.

## Owns

World time, seasonal parameters, weather cells, fronts, precipitation, wind, and
weather-to-terrain effects. Climate fields from the map are long-term inputs; weather is
short-term state.

## Interaction Model

Weather should interact with every major world layer without collapsing them together:

- terrain: rain darkens soil, snow covers exposed ground, thaw creates mud, heat dries
  puddles;
- roads: traffic corridors gain wet, muddy, snowy, or slushy surface conditions based on
  local biome and weather;
- settlements and cities: access, traffic quality, and visuals respond to persistent
  conditions;
- characters and creatures: locomotion, visibility, comfort, equipment, and habitat
  behavior can later consume weather state;
- future rivers and drainage: accumulation, flooding, and marsh expansion can depend on
  multi-step weather history.

Surface effects must be reversible. Weather paints temporary surface state over
underlying geography; when conditions change, those overlays decay rather than mutate the
base biome.

## Current Slice

The current runtime uses deterministic weather phases and derived local surface conditions:

- clear, rain, snow, and thaw states are defined in `world.json`;
- chunk overlays can add wet sheen, mud, snow dusting, or slush over terrain and roads;
- intensity fades through the cycle instead of switching abruptly.

The shared surface query now returns local `dry`, `wet`, `muddy`, `snowy`, `slushy`, or
`flooded` condition from seed, clock phase, biome, and world cell. It is reversible and
does not mutate base terrain. Roads consume the same query for movement and rendering;
traffic, settlements, creatures, and saves remain the next modular consumers.

## Planned Vertical Slices

1. Complete: visual surface cycle over terrain and roads.
2. Complete: movement and road-condition modifiers from weather state.
3. Settlement traffic and supply effects.
4. Region-scale fronts, wind, and drainage feedback.
5. Saveable world weather history and forecast surfaces.

The broad design tracker `#31` is decomposed into `#45` for the deterministic regional
state/persistence core and `#46` for settlement, creature, visibility, drainage, HUD, and
developer consumers. Implement `#45` first; consumers must query its stable API instead
of reading renderer state or inventing separate clocks.

## Dependencies and Tests

Depends on map climate/elevation, roads, and a fixed simulation clock. Test seed/time
determinism, bounded updates, pause/resume, surface fade behavior, and save restoration.
