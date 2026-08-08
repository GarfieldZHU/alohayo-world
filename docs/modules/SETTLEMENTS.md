# Settlement Module

**Status:** deterministic site layer active; aggregate traffic consumer shipped (`#48`).

## Owns

Settlement sites, building footprints, population groups, jobs, services, construction,
and growth policies.

## First Vertical Slice

Choose a suitable lowland site, place one configurable building, consume local
resources, and grow a small settlement over deterministic ticks.

## Traffic Handoff

`simulateSettlementTraffic` produces bounded, deterministic snapshots for retained
settlements. Demand, congestion, maintenance, and supply access consume settlement road
access, dominant road traffic, transport-structure markers, regional weather, and the
configurable traffic scales. The engine publishes aggregate values as developer
diagnostics; it does not spawn per-frame agents or mutate settlement state. Fully simulated
routes and moving agents are tracked in #60.

## Dependencies and Tests

Depends on map suitability, characters, resources, and persistence. Test placement
rules, footprint conflicts, deterministic growth, and disable/unload behavior.
