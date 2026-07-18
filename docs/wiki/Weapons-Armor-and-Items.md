# Weapons, Armor, and Items

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [武器、防具与物品](Weapons-Armor-and-Items-zh-CN) · **Translation status:** synced with EN 1.0.0

Equipment is config-defined by families, slots, requirements, tags, and effects. Named
instances, quality, durability, techniques, affixes, and visual assets layer on top; core
rules do not hard-code a particular sword or armor set.

## Slot Model

The shared character model supports wearable slots for head, torso, hands, legs, feet,
waist, back, and outer layer; six decorator/accessory slots; and multiple weapon slots for
switching active loadouts. Content declares compatibility. NPCs and enemies use the same
slots and may fix, share, or draw equipment from pools.

## Weapon Families

| Family           | Design identity                                  | Terrain/system relationship              |
| ---------------- | ------------------------------------------------ | ---------------------------------------- |
| jian             | balanced double edge, precision, adaptable reach | constrained paths and technique variety  |
| dao              | committed cuts and practical field use           | brush clearing and robust travel weapon  |
| qiang            | spear reach and formation control                | roads, bridges, chokepoints, mounted use |
| gun              | staff control and low material cost              | non-edge utility and footing control     |
| bow/crossbow     | ranged pressure with ammunition                  | visibility, elevation, weather, cover    |
| axe/hammer tools | impact and utility with commitment               | wood, rock, construction, high stamina   |
| unarmed/short    | low load and close range                         | confined spaces, backup, concealment     |

Weapons declare requirements, ability scaling, grip modes, mass, reach, stamina cost,
damage tags, proficiency tags, and compatible technique IDs. Switching consumes action
time in future combat; inventory ownership and ammunition remain explicit state.

## Armor Profiles

Travel cloth, lacquered leather scale, iron lamellar, and ceremonial-heavy profiles form
the first original set. Armor trades mass/noise/flexibility for poise, protection, and
environment resistance. Layering and body slots matter: a warm outer layer may protect
against snow but increase heat load in a desert; waterproof footwear helps marsh control
without granting ocean entry.

Historical references guide materials and construction. Statistics, names, silhouettes,
and cultures remain original and must identify period/region when drawing on a specific
object.

## Item Categories

- remedies and medical tools;
- food, water, fuel, and travel provisions;
- repair, climbing, surveying, crafting, and construction tools;
- arrows, bolts, thrown ammunition, and future consumable charges;
- ritual objects with registered, costed capabilities;
- maps, permits, contracts, letters, and research documents;
- raw materials, components, trade goods, and quest evidence.

Items may grant tags such as `traversal:climb`, `protection:cold`, `knowledge:river`, or
`tool:repair`. Systems consume registered tags/queries instead of importing item code.

## Instance and Inventory Direction

Future item instances add owner/container, stack count, condition, durability, quality,
provenance, custom name, and optional modifiers. Transactions must be deterministic and
atomic. Load calculation includes equipped and carried mass; containers can change access
cost without making mass disappear. Save migration is required before this becomes live.

## Destruction and Repair

Durability represents specific material failure, not a universal timer. Water, mud, salt,
heat, cold, corrosion, impact, and poor maintenance affect compatible materials. Repair
requires tools, skill, material, place, and time appropriate to the item. Broken items may
become damaged instances or salvage rather than vanish automatically.
