# Vehicle Module

**Status:** deferred plugin.

## Owns

Vehicle definitions, occupancy, steering, acceleration, fuel/energy, terrain
compatibility, and route constraints.

## First Vertical Slice

Enter one configurable vehicle and drive along an authored road with distinct handling
on road, lowland, wetland, and water.

## Dependencies and Tests

Depends on map surfaces, roads, characters, input, and persistence. Test deterministic
movement, collision, enter/exit ownership, and cleanup.
