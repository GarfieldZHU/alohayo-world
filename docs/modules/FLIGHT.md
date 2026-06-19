# Flight Module

**Status:** planned. Dev-only flight exists for testing; player-facing flight does not.

## Goal

Turn flight from a debug bypass into a normal locomotion capability granted by content.

## Principles

- Flight must be data-driven through character, gear, vehicle, mount, or effect
  definitions.
- The engine should ask locomotion capabilities whether a terrain can be crossed instead
  of hard-coding role-specific exceptions.
- Camera, visibility, stamina, and encounter rules should respond to a locomotion mode,
  not to a one-off boolean.
- Debug flight remains available for test setup, but it must reuse the same movement
  hooks as the future gameplay implementation whenever possible.

## Planned Capability Model

1. Add locomotion tags such as `walk`, `swim`, `climb`, `fly`, and `sail`.
2. Let archetypes define baseline locomotion and let equipment/effects add or remove
   tags.
3. Replace the current movement-cost gate with terrain compatibility queries.
4. Add optional modifiers for altitude, stamina drain, visibility radius, and landing
   constraints.
5. Surface locomotion state through HUD, AI hooks, and save data.

## First Gameplay Slice

- A wearable or mount grants `fly`.
- Water, marsh, canyon, and mountain traversal uses capability checks instead of a dev
  bypass.
- Flight has a constrained tactical camera profile and a larger but bounded vision rule.
- Discovery, encounters, and action range remain deterministic.

## Dependencies

- Character/equipment capability schemas.
- Terrain traversal query abstraction.
- Camera profile registry.
- Save-data support for active locomotion mode.
