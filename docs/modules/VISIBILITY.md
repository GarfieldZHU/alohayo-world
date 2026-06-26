# Visibility Module

**Status:** active first slice.

## Owns

Discovery memory, active battle-shadow visibility, smooth fog-frontier rendering, and the
future skill/action rule for checking whether a target crosses into shadow.

## Model

Visibility has two layers:

- **Discovery memory:** a chunk-local cell mask used for saves, minimap progress, and
  deciding whether a place has ever been seen.
- **Continuous visibility field:** a sampled curve around the explorer. This is not bound
  to cell edges; a single terrain cell can be partly visible and partly shadowed.

Game rendering must read from the continuous field whenever it draws the active frontier.
Cell masks are storage data, not the visual border.

## Current Slice

- `sampleVisionAtPoint` returns a visibility value in `[0, 1]`.
- `pointCrossesVisionShadow` applies the shared `VISION_ACTION_THRESHOLD`.
- Chunk fog now paints mist first, then erases a connected, feathered visibility field
  from discovered cells. This removes hard unit-cell borders in game mode.
- Discovery reveal uses the same continuous sample so new cells are discovered by a
  curved frontier instead of a square or diamond stamp.

## Future Skill Contract

Combat, magic, tools, projectiles, and creature senses should not ask "is this target
cell discovered?" for active skill resolution. They should sample points along the action
line:

1. Sample from actor to target at sub-cell intervals.
2. If all samples are above `VISION_ACTION_THRESHOLD`, the action is fully valid.
3. If some samples cross below the threshold, the action chooses its own rule:
   disappearing attack, weakened attack, blocked attack, or shadow-valid attack.
4. Store that rule on the skill/equipment config, not inside the visibility module.

This lets light magic, blind attacks, stealth, flying sight, and future equipment modify
visibility without rewriting terrain discovery.

## Rendering Rules

- The visible side should remain readable and should not be eaten by a heavy blur.
- The hidden side may feather and wobble into mist.
- Game mode must not show grid lines at the fog border.
- Dev mode may expose grid and diagnostics, but the default battle-shadow surface should
  still use the same continuous contract.

## Tests

Keep tests around:

- center visibility is high;
- far shadow visibility is low;
- frontier samples are partial;
- action threshold behavior is stable.
