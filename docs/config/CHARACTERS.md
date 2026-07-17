# Character Configuration

The character model is shared by players, friendly/neutral NPCs, and enemies. A role
changes behavior selected by later systems; it does not change stats, appearance,
equipment, or save representation.

## Catalog Files

```text
content/characters/core/
  abilities.json
  appearance.json
  slots.json
  items.json
  equipment-pools.json
  actions.json
  archetypes.json
  index.json

content/characters/extensions/eastern-frontier-v1/
  resources.json
  roles.json
  weapons.json
  armors.json
  item-categories.json
  terrain-interactions.json
  index.json
```

## Abilities

The core pack starts with Strength, Agility, Endurance, Intelligence, Perception,
Willpower, Charisma, and Luck. Each ability has a namespaced ID, display metadata,
group, minimum, maximum, and default.

The generator iterates the ability catalog. To add `my-pack:engineering`, append its
definition and optionally add a roll range to archetypes. Existing characters receive
the ability's default without code changes.

An archetype ability may be fixed or rolled:

```json
"my-pack:engineering": { "minimum": 8, "maximum": 15 }
```

```json
"my-pack:engineering": { "minimum": 12, "maximum": 12, "fixed": 12 }
```

## Appearance

Global pools include body shape, build, height, face shape, skin tone, eye shape/color,
hair style/color, and facial hair. Generation is deterministic from seed plus
archetype ID.

Archetypes may:

- omit appearance config to use all global pools;
- restrict a pool for a population;
- fix a value for a specific authored person.

```json
"appearance": {
  "fixed": { "hairStyles": "bun" },
  "pools": { "builds": ["lean", "athletic"] }
}
```

## Equipment Slots

The core catalog has eight wearable slots:

`head`, `face`, `torso`, `outerwear`, `hands`, `waist`, `legs`, `feet`.

It has six decorator slots:

`ears`, `neck`, `left wrist`, `right wrist`, `left hand ring`, `right hand ring`.

It has four weapon slots:

`primary`, `secondary`, `ranged`, `utility`.

Slots are data. Add another slot by defining its ID, kind, accepted item tags, render
layer, and whether it is optional.

## Items, Fixed Gear, and Shared Pools

Items declare allowed slots, visual properties, tags, optional ability modifiers, and
whether the item definition is shareable. Archetypes equip:

- `fixedItemId`: exact authored gear;
- `poolId`: deterministic random selection from a reusable pool;
- `shared: true`: the selection may refer to common/shared inventory semantics later.

The current generator records sharing intent but does not yet implement world inventory
ownership. Unique runtime item instances and durability arrive with inventory.

## Weapon Switching

`weaponSetSlots` is an ordered list of weapon slots available to the character. The
first is initially active. Input and combat systems will switch active slots without
changing the equipment model.

## Optional Character Rules Pack

`eastern-frontier-v1` is consumed by `@alohayo/character-rules`, not by the renderer or
the core generator. It defines weighted derived resources, occupational backgrounds,
weapon families, armor profiles, item categories, and map-aware traversal rules.

All visible definitions use `nameKey` and `descriptionKey`. Add both English and
Simplified Chinese catalog entries before adding a definition. Formulas are declarative
weighted sums; configuration cannot execute code.

Terrain interactions reference stable terrain IDs, surface IDs, role IDs, and capability
tags. They return movement, stamina, control, exposure, and blocked state. Roads, weather,
inventory, and combat may consume that result later, but they must not be imported into
the rules package.

To remove the delta, omit the pack and registry. `evaluateTerrainTraversal` returns
neutral values when no registry is supplied, and the current explorer remains unchanged.

## Movement and Actions

Archetypes configure walk speed, run multiplier, interaction range, and allowed action
IDs. Actions configure duration, range, input intent, and registered target kind.

See `../MOVEMENT_AND_ACTIONS.md` for the runtime algorithm, one-ninth terrain scale,
collision rules, controls, and extension invariants.

## Adding a Person, NPC, or Enemy

1. Add or reuse ability, appearance, slot, item, and pool definitions.
2. Add one archetype with `role: player`, `npc`, or `enemy`.
3. Set fixed values for authored identity and pools for generated populations.
4. List equipped slots and switchable weapons.
5. Add behavior/combat references only when those registered modules exist.
6. Run `yarn validate:content`, `yarn test`, and `yarn build`.

## Current Runtime

`@alohayo/character` deterministically generates all abilities, appearance choices,
equipment selections, and the active weapon slot. The demo's visible Wayfinder marker
uses generated skin, hair, body proportions, height, and equipped clothing color. It
walks, runs, collides with water, changes facing, follows terrain cost, and interacts
through content-defined actions. Layered sprites, inventory instances, behavior AI,
pathfinding, and combat remain next-stage systems.

The optional rules pack is validated and unit tested but is not yet connected to live
movement, HUD, saves, or combat. That explicit boundary prevents an early data experiment
from silently changing player behavior.
