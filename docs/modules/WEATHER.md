# Weather Module

**Status:** planned with basic visual surfacing active.

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

The current runtime uses deterministic weather phases only for render surfaces:

- clear, rain, snow, and thaw states are defined in `world.json`;
- chunk overlays can add wet sheen, mud, snow dusting, or slush over terrain and roads;
- intensity fades through the cycle instead of switching abruptly.

This is intentionally visual-first and does not yet alter movement, economy, or AI.

## Planned Vertical Slices

1. Visual surface cycle over terrain and roads.
2. Movement and road-condition modifiers from weather state.
3. Settlement traffic and supply effects.
4. Region-scale fronts, wind, and drainage feedback.
5. Saveable world weather history and forecast surfaces.

## Dependencies and Tests

Depends on map climate/elevation, roads, and a fixed simulation clock. Test seed/time
determinism, bounded updates, pause/resume, surface fade behavior, and save restoration.
