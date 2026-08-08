# Vehicle Module

**Status:** profile contract active; occupancy and simulation deferred.

## Owns

Vehicle definitions, occupancy, steering, acceleration, fuel/energy, terrain
compatibility, and route constraints.

## First Vertical Slice

Enter one configurable vehicle and drive along an authored road with distinct handling
on road, lowland, wetland, and water.

## Current Contract

Content now defines mount and vehicle profiles with stable IDs, capability tags, compatible
road kinds, speed multipliers, capacity, and maintenance rates. Profiles use the #47
transport traversal query rather than reading rendered road geometry. Enter/exit,
occupancy, fuel, steering, and moving agents remain future work in #60.

## Dependencies and Tests

Depends on map surfaces, roads, characters, input, and persistence. Test deterministic
movement, collision, enter/exit ownership, and cleanup.
