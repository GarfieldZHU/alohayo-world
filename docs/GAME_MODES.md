# Game Modes

## Purpose

Alohayo World now has two distinct player-facing modes built on the same seeded world.

- **World Mode** is the live geography explorer and atlas-creation surface.
- **Game Mode** is the next embodied playable mode with a fixed follow camera, a main
  character, settlements, roads, sites, and a full HUD.

Implementors should preserve the mode split instead of blending both into a single
ambiguous camera/input model.

## World Mode

### Role

- generate the world from a seed;
- inspect geography, topology, and authored overlays;
- validate terrain, coasts, islands, lakes, highlands, and future road/site placement;
- serve as a tooling-quality view for map debugging and content authoring.

### Camera and Interaction

- free pan/zoom atlas camera;
- direct terrain/cell inspection;
- support larger bounded presets and future streamed-world validation;
- keep it useful for reading coordinate axes and region-level world structure.

### Required Readouts

World Mode should progressively surface:

- X/Y coordinate axes or stable position readouts;
- elevation / z-index band or terrain height tier;
- terrain class and topology identity;
- movement affordance expectations derived from current terrain;
- future road/site/debug overlay visibility toggles.

## Game Mode

### Role

- turn the generated world into a playable exploration layer;
- center the experience around one explorer character;
- use roads, terrain, settlements, caves, and dungeons as gameplay structure;
- preserve deterministic world identity while shifting from atlas reading to movement,
  interaction, and local decision-making.

### Camera and Feel

- fixed follow camera;
- player-centered readability over atlas completeness;
- minimap and HUD must carry context that World Mode shows directly on the map;
- movement, speed, and terrain friction should be felt immediately.

### First Playable Expectations

The first Game Mode slice should include:

- a basic main-character model/silhouette;
- walk and run as stable defaults;
- planned extension points for swim and fly;
- visible position, elevation, terrain, and site context;
- a HUD with status, actions, minimap, and location readouts;
- seeded roads and at least one settlement/site category visible in play.

## Implementor Notes

- Dig deeper into camera readability and occlusion handling before shipping fixed-camera play.
- Keep terminology shared between World Mode and Game Mode so players can learn once.
- If a requirement is still fuzzy, extend the docs before encoding irreversible runtime behavior.
