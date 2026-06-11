# Game Design

## Vision

Alohayo World is a vivid configurable world platform. Geography is the shared
foundation for RPG exploration, settlement building, life simulation, vehicles,
strategy, and creature-oriented adventures.

## First playable

The demo offers a seed-driven world atlas. Players pan and zoom, inspect climate and
elevation, regenerate worlds, and learn how terrain layers become biomes. It proves the
map model, rendering path, lazy loading, determinism, and embedding contract.

## Design pillars

1. **The map is gameplay.** Terrain affects movement, resources, visibility, settlement,
   encounters, and future simulation.
2. **Content is data.** Designers add definitions and assets without editing engine code.
3. **Immediate and local.** No account, server, telemetry, or network gameplay.
4. **Fast at scale.** Stream chunks, batch rendering, move hot loops to workers/Wasm.

## Deferred

Combat, inventory, NPC schedules, construction, economy, vehicles, farming, and creature
collection are plugin contracts after the world foundation is proven.
