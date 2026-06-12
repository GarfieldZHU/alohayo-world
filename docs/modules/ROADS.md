# Road Module

**Status:** planned after streamed geography and drainage.

## Owns

Road classes, route hierarchy, terrain-aware placement, traversal modifiers, settlement
connectivity, and future vehicle-compatible navigation surfaces.

## Road Classes

- trail
- path
- local road
- main road
- grand avenue

## First Vertical Slice

Generate a deterministic road network that:

- connects at least one seeded settlement or landmark pair;
- changes movement speed by road class;
- respects terrain suitability;
- renders visible hierarchy differences;
- exposes road class to inspection and HUD readouts.

## Terrain Rules

- **Plains / lowland:** richest road network; all classes possible.
- **Highland / snowland:** sparse roads; usually main routes only.
- **Deep desert:** almost no interior roads; paths gather around edges, trade lines, and oasis chains.
- **Forest:** mostly narrow roads and paths.
- **Wetland:** sparse small roads, fragile crossings, limited branching.
- **Town / city core:** dense hierarchy from lanes to wide planned roads.

## Settlement Interaction

- Villages cluster houses around one to several roads.
- Towns grow a connected local road system with a clear center.
- Cities require broad main roads, forks, secondary streets, and district-scale planning.

## Dependencies and Tests

Depends on map topology, drainage/water, settlements, movement, and future vehicles.
Test deterministic routing, terrain suitability, road-class movement modifiers, and seamless
chunk boundaries.

## Implementor Notes

Implementors should dig further into:

- junction density heuristics;
- bridge/causeway rules;
- district-aware avenue planning in major cities;
- how roads interact with future authored overlays and scenario packs.
