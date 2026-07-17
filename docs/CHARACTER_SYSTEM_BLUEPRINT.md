# Character System Blueprint

**Status:** design baseline and optional rules delta in progress (`#39`).

## Product Goal

Build one configurable character model for players, NPCs, and enemies that supports
exploration, deliberate combat, social roles, crafting, survival, and future simulation.
The model combines transparent tabletop-style rules, committed action-RPG trade-offs,
and carefully sourced Chinese material history inside an original world.

This document defines direction. Current executable behavior is listed in
`modules/CHARACTERS.md`; Wiki-oriented introductions live in `wiki/`.

## Non-Negotiable Architecture

- `@alohayo/character` owns identity generation and fixed-step body motion.
- `@alohayo/character-rules` is an optional pure-rules plugin with no DOM, PixiJS,
  worker, input, or persistence imports.
- `packages/config` owns serializable contracts; JSON cannot execute formulas or code.
- Stable IDs and tags cross module boundaries. Translated names and colors never do.
- Terrain remains authoritative for geography. Character gear supplies capabilities and
  mitigation, not terrain mutation.
- Players, NPCs, and enemies use the same abilities, slots, resources, and item rules.
- The first delta does not migrate saves or change the live explorer. It can be removed
  by deleting one optional pack/package with no renderer rollback.

## Rules Model

### Abilities

The current eight abilities are strength, agility, endurance, intelligence, perception,
willpower, charisma, and luck. Content may add more IDs. Calculations iterate the ability
catalog; no switch statement assumes exactly eight.

### Derived Resources

Resources use declarative weighted sums with a base, minimum, and explicit rounding:

`value = round(base + sum(ability[id] * weight[id]))`

The first catalog defines vitality, stamina, focus, poise, load, and resolve. These are
capacity values, not mutable combat state. Damage, regeneration, and save representation
remain a later module.

### Background Roles

Roles describe learned context rather than lock a class tree. They provide ability
priorities, proficiency tags, terrain affinities, and starting item tags. Later systems
may combine a role with faction, culture, profession, oath, or teacher records.

### Equipment

Weapons declare requirements, scaling, grip, mass, reach, stamina commitment, damage
tags, and proficiency tags. Armor declares mass, poise, protection, environment
resistance, noise, and flexibility. Item categories declare inventory behavior. Named
instances and affixes extend these families later.

### Terrain Interaction

A pure query consumes terrain ID, surface IDs, role IDs, and equipment/capability tags.
It returns movement, stamina, control, and exposure modifiers plus matched rule IDs.
Rules are priority ordered and deterministic. Future movement, AI, combat, weather, and
survival modules consume this result without importing one another.

## Progression Blueprint

1. **Foundation:** deterministic abilities, appearance, slots, and archetypes (active).
2. **Rules delta:** resources, role catalog, equipment families, and terrain query (`#39`).
3. **Inventory state:** item instances, stacks, load, durability, transactions, save schema.
4. **Action economy:** stamina/focus spending, wind-up, active, recovery, interruption.
5. **Advancement:** use, training, teachers, discoveries, role relationships, respec rules.
6. **AI parity:** NPC planning consumes the same action costs and terrain capabilities.
7. **Content packs:** factions, cultures, named equipment, techniques, creatures, encounters.

## Combat Direction

Combat should be readable and committed: range, facing, timing, stamina, poise, load,
terrain, and visibility matter. It should not copy a particular game's animation frames
or balance tables. Planned action phases are intent, wind-up, active, recovery, and
cancel/interrupt. The battle-shadow frontier is a spatial query boundary for skills,
projectiles, and AI awareness, not merely a visual overlay.

## Chinese-History Design Method

Use dated, regional, and material-specific references. Jian, dao, spear, staff, bow,
crossbow, lacquered leather scale, iron lamellar, caravan administration, river works,
archives, craft guilds, and plural medical traditions are useful foundations. They must
be recombined into original cultures and equipment instead of presented as one timeless
or mysticalized China.

## Research References

- D&D SRD 5.2.1, CC BY 4.0:
  https://www.dndbeyond.com/resources/1781-systems-reference-document-srd
- Bandai Namco, _Elden Ring Beginner's Guide_:
  https://en.bandainamcoent.eu/elden-ring/news/elden-ring-beginners-guide
- Bandai Namco, _The Best Tips for Beginners_:
  https://en.bandainamcoent.eu/elden-ring/news/elden-ring-the-best-tips-beginners
- Metropolitan Museum, Chinese swords and arms collection search:
  https://www.metmuseum.org/art/collection/search?q=Chinese%20sword
- British Museum collection, Chinese armour objects and records:
  https://www.britishmuseum.org/collection/search?keyword=Chinese&keyword=armour
- UNESCO Courier, Dai medicine and cultural transmission:
  https://courier.unesco.org/en/articles/dai-medicine-treasure-house

These sources support design synthesis; they do not license copying protected game
content. Museum records should be cited at object level when a future asset or named item
uses a specific construction or motif.

## Acceptance Gates

- Empty/absent rules pack preserves existing output.
- Catalog validation catches duplicate IDs, unknown abilities/terrains/roles, invalid
  ranges, and missing localization keys.
- Derived resource and terrain queries are pure, deterministic, and unit tested.
- English and Simplified Chinese catalogs cover every visible definition.
- No renderer, worker, save, or live HUD behavior changes in the initial delta.
- Docs, tests, content validation, lint, typecheck, and production build pass.
