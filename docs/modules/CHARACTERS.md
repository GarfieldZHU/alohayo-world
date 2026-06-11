# Character Module

**Status:** planned for the living-explorer stage.

## Owns

Character definitions, identity, stats, movement intent, locomotion modes, inventory
references, interaction reach, and save state.

## Data First

Definitions provide sprite set, movement profile, capabilities, starting components,
and progression tables. Runtime code implements registered movement and interaction
systems; definitions do not contain scripts.

## First Vertical Slice

One explorer can spawn on traversable mainland, walk between cells, collide with blocked
terrain, inspect a landmark, rest, and resume from a local save.

## Dependencies and Tests

Depends on map queries, input commands, clock, and persistence. Test deterministic spawn,
movement costs, collision, lifecycle cleanup, and save round trips.
