# Combat Module

**Status:** deferred plugin.

## Owns

Encounter state, actions, damage types, equipment effects, status effects, rewards, and
combat AI policies selected from registered capabilities.

## First Vertical Slice

One optional encounter using data-defined actors, weapon, armor, actions, and rewards.
The world remains playable with the combat plugin disabled.

## Dependencies and Tests

Depends on characters, creatures, inventory, and map encounter locations. Test seeded
resolution, invalid content rejection, equipment math, and plugin unload.
