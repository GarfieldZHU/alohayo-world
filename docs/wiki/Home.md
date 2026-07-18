# Alohayo World Wiki

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [中文首页](Home-zh-CN) · **Translation status:** synced with EN 1.0.0

Alohayo World is a map-first, local-only role-playing world. Geography is authoritative:
terrain, water, roads, weather, settlements, travel, character backgrounds, equipment,
and encounters interact through stable, serializable contracts. The game loads on demand,
runs entirely in the browser, and keeps preferences and saves on the local machine.

## Read By Goal

### Understand the world

- [World and Terrain](World-and-Terrain): physical layers, topology, hydrology, terrain
  classification, surfaces, and the 26-terrain catalog.
- [Background World](Background-World): the Confluence setting, cultures, institutions,
  geographic pressures, and tone.
- [Character and Map Interactions](Character-and-Map-Interactions): how terrain, roads,
  weather, capabilities, equipment, and future actions compose.

### Understand characters and equipment

- [Character System](Character-System): shared player/NPC/enemy model and module boundary.
- [Abilities and Roles](Abilities-and-Roles): eight extensible abilities, derived
  resources, backgrounds, proficiency, and progression direction.
- [Weapons, Armor, and Items](Weapons-Armor-and-Items): slots, equipment families,
  capability tags, inventory direction, and historical design method.

### Extend the repository

- [Repository Architecture](Repository-Architecture): workspace ownership, lifecycle,
  worker/Wasm boundary, persistence, testing, and lazy embed contract.
- [Content and Modding](Content-and-Modding): stable IDs, JSON packs, authored areas,
  terrain/character additions, validation, and localization order.
- [Sources and Design Boundaries](Sources-and-Design-Boundaries): licenses, historical
  references, original-world policy, and prohibited copying.
- [Wiki Versioning](Wiki-Versioning): English authority, Chinese translation tracking,
  page versions, and publication workflow.

## Current Foundation

The v0.1.3 baseline includes streamed infinite chunks with bounded retention, deterministic
topology and hydrology, 26 terrain types, curved weather-aware roads, discovery and
minimap, day/night lighting, authored map overlays, local save slots, shared character
generation, and stable Rust/Wasm batches for chunk base layers and hydrology.

The active follow-up program covers persistent topology and rivers, GPU-assisted natural
world masks, regional weather, transport structures and traffic, character/inventory
state, and measured additional Wasm candidates. The [project issues](https://github.com/GarfieldZHU/alohayo-world/issues)
are the live delivery tracker; this Wiki explains system intent and boundaries.

## Authority

The GitHub Wiki is a readable system guide. The repository remains authoritative:

- schemas and public interfaces: `packages/config`;
- deterministic world rules: `packages/map` and `content/`;
- character domain: `packages/character` and `packages/character-rules`;
- runtime/rendering: `packages/engine`;
- lazy host integration: `packages/embed`;
- measured numeric hot loops: `crates/world-core`;
- agent rules: root and nested `AGENTS.md` files.

When Wiki prose disagrees with validated JSON or code, fix the Wiki and bump its page
version. Never silently change runtime behavior to match stale prose.
