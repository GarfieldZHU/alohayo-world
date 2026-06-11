# Weather Module

**Status:** planned.

## Owns

World time, seasonal parameters, weather cells, fronts, precipitation, wind, and
weather-to-terrain effects. Climate fields from the map are long-term inputs; weather is
short-term state.

## First Vertical Slice

Deterministic day/night progression and rain moving across a region, with wetland and
highland probabilities influenced by geography.

## Dependencies and Tests

Depends on map climate/elevation and a fixed simulation clock. Test seed/time
determinism, bounded updates, pause/resume, and save restoration.
