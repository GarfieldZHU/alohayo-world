# Character System

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [角色系统](Character-System-zh-CN) · **Translation status:** synced with EN 1.0.0

Players, NPCs, allies, creatures, and enemies share one character-domain model. Input,
AI, faction, and encounter plugins decide behavior; identity, ability, body, equipment,
resource, and traversal contracts do not fork by actor type.

## Domain Layers

1. **Identity:** stable ID, localized name key, tags, pronouns, culture, faction, and role
   references.
2. **Body and appearance:** deterministic body shape, face, hair, skin, and visual pools;
   appearance is not combat authority.
3. **Abilities:** extensible bounded attributes; the first catalog contains eight.
4. **Background roles:** learned context, proficiencies, terrain familiarity, and starting
   item tags without permanent class locks.
5. **Derived resources:** vitality, stamina, focus, poise, load, and resolve from explicit
   weighted formulas.
6. **Loadout:** at least eight wearable slots, six decorator slots, and multiple switchable
   weapon slots from the shared model.
7. **Capabilities:** climb, swim, boat, fly, cold/heat protection, read, repair, heal, and
   similar tags granted by body, role, equipment, effect, or environment.
8. **State:** mutable health/resources, conditions, inventory instances, durability,
   progression, relationships, and discovery; staged behind save migrations.

## Current Implementation Boundary

`@alohayo/character` owns deterministic generation and fixed-step body motion. The
explorer footprint is one ninth of a terrain cell and movement states include idle, walk,
run, and action. `@alohayo/character-rules` is an optional pure package for derived
resources, equipment families, roles, and terrain queries. It imports no DOM, PixiJS,
input, worker, or persistence code.

Removing the optional rules pack restores neutral derived/traversal behavior without
rewriting rendering or the existing generator. This reversible delta is the safety model
for future combat, inventory, survival, and social plugins.

## Rules Philosophy

- Checks and requirements are readable and based on explicit inputs.
- Stamina, commitment, reach, poise, load, visibility, and terrain create build trade-offs.
- Requirements reduce effectiveness or unlock technique use; they do not mutate base
  abilities to make an item fit.
- Stable IDs and tags cross modules; translated names and colors never do.
- JSON selects registered formulas/rules and cannot execute arbitrary code.

## Progression Direction

Progression combines use, teachers, study, discoveries, role relationships, equipment,
and deliberate investment. Diminishing returns and explicit respecialization costs avoid
both irreversible class traps and consequence-free instant rebuilding. NPC planning must
eventually consume the same action costs, capabilities, and terrain queries as the player.

## Future State Gates

Inventory instances, damage, regeneration, durability, transactions, advancement, and
combat actions require versioned save schemas and deterministic tests before becoming
runtime authority. The renderer may display state but never own it.
