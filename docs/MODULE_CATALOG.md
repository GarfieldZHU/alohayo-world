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

## Planned Modules

| Module      | First useful outcome                   | Depends on        |
| ----------- | -------------------------------------- | ----------------- |
| Map         | streamed geography, drainage, overlays | config, worker    |
| Characters  | one controllable explorer              | map, input, saves |
| Weather     | deterministic local weather fronts     | map, clock        |
| Settlements | place and grow one settlement          | map, characters   |
| Economy     | resources, inventories, local exchange | settlements       |
| Combat      | data-driven encounters and equipment   | characters        |
| Vehicles    | roads, steering, traversal modes       | map, characters   |
| Creatures   | habitats, spawning, observation        | map, weather      |

Read the matching `modules/*.md` before implementing one.
