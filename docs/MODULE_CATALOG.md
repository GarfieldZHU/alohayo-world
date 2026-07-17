# Module Catalog

## Dependency Direction

`config -> map -> engine -> embed -> host`

Gameplay modules depend on public world/query services and emit commands or events.
They do not reach into PixiJS, worker internals, or another module's private state.

## Extension Protocol

Every module must define:

- content schemas and namespaced IDs;
- authoritative state and derived render state;
- commands, events, queries, and save representation;
- deterministic update order;
- ownership and cleanup;
- performance budget and degradation strategy;
- unit, integration, and lifecycle tests;
- one narrow playable vertical slice.

Configuration may select a registered implementation but cannot provide executable
scripts.

## Foundation Status (`v0.1.3`)

| Module      | Status     | Current outcome                                      | Next tracked boundary       |
| ----------- | ---------- | ---------------------------------------------------- | --------------------------- |
| Map         | foundation | streamed geography, hydrology, topology, overlays    | #37, #38                    |
| Water       | foundation | hydrology, rivers, contours, geomorphology metadata  | #38, #41, #44, #50          |
| Visibility  | active     | discovery memory and continuous sampled frontier     | skill/action consumers      |
| Roads       | foundation | tiered curved roads and weather-aware travel         | #47, #48                    |
| Characters  | foundation | generated explorer, abilities, appearance, equipment | #39 rules delta             |
| DayNight    | active     | wrapped solar clock, phases, moonlight, dev override | seasons and schedules       |
| Weather     | foundation | reversible terrain/road surface conditions           | #45, #46                    |
| Settlements | planned    | suitability and building-growth contract             | first settlement slice      |
| Economy     | planned    | resources, inventories, and exchange contract        | inventory ownership         |
| Combat      | deferred   | optional encounter/plugin boundary                   | character delta             |
| Vehicles    | planned    | shared road/traversal capability boundary            | roads and locomotion        |
| Creatures   | planned    | habitat-driven spawn and observation boundary        | map/weather habitat queries |

`foundation` means the deterministic public/data contract and one runtime slice exist;
it does not mean the module's long-term simulation is complete. Follow the linked issue
and nearest module document rather than expanding a foundation ad hoc.

Read the matching `modules/*.md` before implementing one.
