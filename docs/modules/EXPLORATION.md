# Exploration Module

**Status:** planned after world-foundation map streaming.

## Owns

Game Mode player embodiment, fixed-camera exploration loop, HUD integration, world-to-player
readouts, and the bridge between seeded geography and local play.

## First Vertical Slice

- spawn one explorer into a seeded world;
- lock to a fixed follow camera;
- move with walk/run states;
- show HUD panels for status, actions, minimap, and location;
- surface coordinates, terrain, elevation/z-band, and current movement mode;
- enter at least one seeded site type such as a cave or village perimeter.

## HUD Plan

### Top Left

- region / biome name;
- local coordinates;
- elevation or z-index band;
- current site or nearest road class.

### Top Right

- minimap;
- discovered roads and settlements;
- camera-lock/tracking indicators.

### Bottom Left

- health / stamina / condition;
- movement toggle state;
- current movement-speed modifier.

### Bottom Center

- action bar;
- interact, inspect, rest, tool, ability, and future mount prompts.

### Bottom Right

- quick inventory / equipment state;
- current site-entry state for settlement, cave, or dungeon transitions.

## Dependencies and Tests

Depends on characters, map spatial queries, roads, settlements, input, UI, and persistence.
Test fixed-camera stability, HUD consistency, deterministic spawn placement, and mode cleanup.

## Implementor Notes

Implementors should dig further into:

- fixed-camera composition and occlusion policy;
- what World Mode readouts become in Game Mode HUD;
- interaction prompt prioritization;
- the smallest stable minimap contract.
