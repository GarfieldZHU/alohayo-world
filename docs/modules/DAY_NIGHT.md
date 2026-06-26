# Day / Night Module

**Status:** active first slice.

## Owns

The deterministic world clock, wrapped east-west sunlight band, moonlight lift, local
time display, and dev override that can pin the world to a manually selected light level
for inspection.

## Model

- One full in-game day equals `24` real-time minutes by default.
- The world wraps horizontally. East and west meet, so lighting repeats cleanly across
  the configured world circumference.
- Each visible screen column samples a world-space local solar hour, not a camera-space
  spotlight.
- Lighting is defined by ordered phase keyframes in `world.json`. Runtime interpolates
  between them to create smooth transitions around dawn, noon, dusk, and night.
- Moonlight is a data-driven night modifier. It tints the darkest phases toward a cool
  lunar color and slightly lifts darkness so night remains playable without turning into
  a character-centered light source.

## First Slice

The current implementation is intentionally render-first:

- a live clock drives a gradient overlay over the world;
- the overlay varies by visible world X position, producing simultaneous day and night
  across different longitudes;
- game mode always keeps the cycle on;
- dev mode exposes a `Day / night` toggle; when disabled, the `Light` slider manually
  samples from midnight to noon so agents and designers can inspect moonlight, dawn, and
  full sun without waiting for the cycle;
- the minimap header shows the current world time.

## Phase Authoring

`world.json.dayNight.phases` is an ordered list of hour anchors:

- `id`: stable phase name for diagnostics and future gameplay hooks;
- `hour`: local hour in `[0, 24)`;
- `darkness`: overlay strength in `[0, 1]`;
- `tint`: the color bias for that phase.

Keep the list ordered by hour. Runtime blends from each phase to the next, wrapping from
the last entry back to the first at `24 -> 0`.

`world.json.dayNight.moonlight` tunes night readability:

- `enabled`: turns moonlight correction on or off;
- `tint`: cool overlay color blended into dark phases;
- `strength`: how strongly lunar color participates at night;
- `midnightLift`: how much darkness is reduced at the deepest night.

## Future Extensions

Planned later work:

1. Terrain-aware shadowing from mountains and dense forests.
2. Seasonal axial tilt that shifts dawn/dusk timing by latitude and calendar month.
3. AI, creature, and settlement schedules that consume phase IDs and local hour.
4. Weather-aware sky tint, cloud dimming, moon phases, and storm flashes.
5. Saveable calendar state with weeks, months, and festivals.

## Dependencies and Tests

Depends on the world width, camera transform, theme contrast, fog readability, and the
shared i18n catalogs. Test:

- stable clock formatting;
- smooth wrapped gradients at viewport edges;
- dev-mode dynamic toggle plus manual midnight-to-noon light slider;
- game-mode automatic cycling;
- minimap/header readability in both light and dark themes.
