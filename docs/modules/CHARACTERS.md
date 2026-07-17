# Character Module

**Status:** configurable generation and streamed exploration foundation active; optional
rules delta tracked in `#39`.

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
- Fixed-step walk/run movement, terrain cost, water collision, facing, camera follow,
  and streamed frontier tolerance when chunks are still loading.
- Config-defined interaction actions with range, duration, target kind, and feedback.
- Discovery reveal around the explorer and minimap presence derived from movement.

## Next Vertical Slice

The reversible first slice is `@alohayo/character-rules`: data-defined derived resources,
background roles, weapon/armor/item families, and terrain traversal queries. It does not
change rendering, saves, or the existing generator. See
`../CHARACTER_SYSTEM_BLUEPRINT.md` and `../wiki/Character-System.md`.

After that: spawn definitions from authored landmarks, layered sprite assembly, mutable
stamina/focus state, context-sensitive targets, NPC steering/pathfinding, inventory item
instances, weapon switching input, richer discovery perks, inspection UI, and save
migrations.

## Ownership Boundary

- `@alohayo/character`: generated identity, appearance, loadout selection, and motion.
- `@alohayo/character-rules`: optional pure calculations and catalog validation.
- map/terrain: geographic facts and base material behavior.
- engine: input and presentation only; never the source of character statistics.
- future inventory/combat: authoritative mutable item and encounter state.

## Dependencies and Tests

Depends on config, map spawn queries, input, clock, and persistence. Tests cover
determinism, complete ability catalogs, shared player/NPC/enemy generation, fixed
appearance, equipment references, and multiple weapon slots.
