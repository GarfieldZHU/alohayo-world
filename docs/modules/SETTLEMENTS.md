# Settlement Module

**Status:** deterministic site layer active; aggregate traffic and bounded agent contract
shipped (`#48`, `#60`); moving agents remain dev-only.

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
configurable traffic scales. `createSettlementAgents` turns those snapshots into sorted,
profile-driven route-choice records capped at 256 agents per retained chunk; a waiting agent
spends one tick yielding to congestion before moving. `stepSettlementAgents` is pure and
save-safe, and never owns Pixi objects or schedules. The engine still publishes aggregate
values as diagnostics rather than spawning agents in game mode; worker presentation and
maintenance/supply consumer wiring remain tracked in #60.

## Dependencies and Tests

Depends on map suitability, characters, resources, and persistence. Test placement
rules, footprint conflicts, deterministic growth, and disable/unload behavior.
