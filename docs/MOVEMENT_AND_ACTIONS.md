# Movement and Actions

This document is both the player-facing behavior contract and the engineering reference
for the first controllable character slice.

## Controls

| Input                | Result                                 |
| -------------------- | -------------------------------------- |
| `WASD` or arrow keys | Walk in eight directions               |
| Hold `Shift`         | Run                                    |
| `E` or `Space`       | Use the first bound interaction action |
| Pointer drag         | Pan the camera in dev mode             |
| Wheel/trackpad       | Cursor-centered zoom in dev mode       |

Gameplay keys are ignored while typing into an input, textarea, or editable element.

## Scale Contract

One terrain cell contains a conceptual `3 x 3` character subcell grid. A standing
character's physical/render footprint is:

```text
width  = terrain cell width  / 3
height = terrain cell height / 3
area   = terrain cell area   / 9
```

`CHARACTER_CELL_FRACTION` and `CHARACTER_TERRAIN_AREA_RATIO` are the authoritative
constants. The selection/action halo is UI feedback and is not part of the physical
footprint.

Positions use floating-point cell coordinates, with cell centers at `(x + 0.5, y +
0.5)`. This allows smooth travel inside and between cells without increasing terrain
array resolution.

## Simulation

The engine accumulates real frame time and advances character motion at a fixed `60 Hz`.
Rendering reads the latest motion state and adds visual stride/bob without modifying
authoritative position.

Movement input is normalized, so diagonal travel is not faster. Each update:

1. read walk direction and run modifier;
2. choose walk or run speed from the archetype movement profile;
3. divide speed by the square root of terrain movement cost;
4. test horizontal and vertical occupancy separately for wall sliding;
5. update position, facing, locomotion state, and distance;
6. offset the camera to follow the character.

Game mode uses a tight follow camera with locked zoom so the visible area stays useful
for exploration and encounters. Dev mode keeps the free camera for inspection, replay,
and map debugging.

Water terrain currently has movement cost `7+` and rejects occupancy in normal gameplay.
Land terrain is traversable but high-cost terrain slows movement. Dev flight can ignore
terrain blocking for testing, but future locomotion profiles should replace this debug
override for swimming, boats, flying, climbing, and vehicles.

## Motion States

- `idle`: no accepted movement.
- `walk`: accepted movement at base speed.
- `run`: accepted movement with `runMultiplier`.
- `action`: movement locked until action duration ends.

Facing is one of north, east, south, or west and follows the dominant input axis.

## Configuring Movement

Every character archetype defines:

```json
"movement": {
  "walkSpeed": 1.8,
  "runMultiplier": 1.85,
  "actionRange": 1.75
}
```

Speeds are terrain cells per second before terrain cost. `actionRange` is a character
cap; the selected action may define a shorter range.

## Configuring Actions

Actions live in `content/characters/<pack>/actions.json`:

```json
{
  "id": "core:interact",
  "name": "Interact",
  "description": "Inspect or use the nearest reachable landmark.",
  "input": "interact",
  "duration": 0.32,
  "range": 1.75,
  "target": "landmark"
}
```

Archetypes list allowed actions in `actionIds`. The first action bound to `interact` is
used by `E`/`Space`. Runtime code owns registered target resolution; JSON cannot execute
logic.

The first target adapter finds the nearest landmark inside both character and action
range, enters the action state, and displays feedback. Later adapters add characters,
items, doors, resources, combat targets, and context-sensitive selection.

## Agent Invariants

- Keep authoritative position in cell units, never screen pixels.
- Never derive simulation speed from render FPS.
- Keep the one-ninth footprint constants stable unless an explicit scale migration is
  approved.
- Collision queries use the footprint corners, not the visibility halo.
- Add locomotion capability data before special-casing terrain or roles.
- Actions select registered target adapters; content never provides functions.
- Players, NPCs, and enemies share motion/action state structures.
- Clear held input on blur and release every listener from `GameHandle.destroy`.

## Next Work

- Character and landmark spawn configs.
- Context-sensitive action selection and an interaction prompt.
- Layered directional sprites and animation clips.
- Stamina and ability-derived movement modifiers.
- Swimming/climbing/vehicle locomotion profiles.
- NPC steering and pathfinding through the same motion commands.
- Save/load of position, facing, action state, and active weapon.
