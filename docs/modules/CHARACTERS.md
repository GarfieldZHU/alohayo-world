# Character Module

**Status:** configurable generation and controllable movement foundation active.

## Owns

Character definitions, roles, extensible abilities, deterministic appearance,
equipment/loadout selection, active weapon slot, identity, and future save state.

## Shared Model

Players, NPCs, and enemies use `CharacterArchetypeDefinition`. Role-specific behavior
will be supplied by AI, input, interaction, and combat modules; the character data model
does not fork.

## Active Foundation

- Eight configurable core abilities with arbitrary extension IDs.
- Body, build, height, face, skin, eyes, hair, and facial-hair pools.
- Eight wearable, six decorator, and four weapon slots.
- Fixed items, reusable item pools, sharing intent, ability modifiers.
- Deterministic generation and initial active weapon selection.
- A generated Wayfinder marker rendered on the map.
- One-ninth-cell physical/render scale contract.
- Fixed-step walk/run movement, terrain cost, water collision, facing, and camera follow.
- Config-defined interaction actions with range, duration, target kind, and feedback.

## Next Vertical Slice

Spawn definitions from authored map landmarks, layered sprite assembly, stamina,
context-sensitive targets, NPC steering/pathfinding, inventory item instances, weapon
switching input, inspection panel, and local save round trips.

## Dependencies and Tests

Depends on config, map spawn queries, input, clock, and persistence. Tests cover
determinism, complete ability catalogs, shared player/NPC/enemy generation, fixed
appearance, equipment references, and multiple weapon slots.
