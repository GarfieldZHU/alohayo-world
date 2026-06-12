# Settlement Module

**Status:** planned.

## Owns

Settlement sites, building footprints, population groups, jobs, services, construction,
and growth policies.

## First Vertical Slice

Choose a suitable lowland site, place one configurable building, consume local
resources, and grow a small settlement over deterministic ticks.

Settlement scale should eventually differentiate:

- **Village:** one to several roads, homes clustered around the road spine.
- **Town:** multiple connected roads with a recognizable center.
- **City:** wide main roads, deliberate forks, dense secondary streets, and district logic.

Related seeded sites should include caves, dungeons, forts/strongholds, ruins, and
wilderness structures.

## Dependencies and Tests

Depends on map suitability, characters, resources, roads, and persistence. Test placement
rules, footprint conflicts, deterministic growth, settlement-class road patterns, and
disable/unload behavior.
