# Character System

Players, NPCs, and enemies share one character model. Input, AI, faction, and encounter
plugins decide behavior; identity, abilities, body, equipment, resources, and traversal
rules do not fork by actor type.

## Layers

1. **Identity:** stable ID, name, tags, pronouns/localization key, culture and faction
   references.
2. **Body and appearance:** deterministic configurable pools; never combat authority.
3. **Abilities:** extensible attributes with bounded values.
4. **Background roles:** proficiencies, terrain familiarity, and starting item tags.
5. **Derived resources:** vitality, stamina, focus, poise, load, and resolve from declarative
   weighted formulas.
6. **Loadout:** eight wearable slots, six decorator slots, and multiple switchable weapon
   slots from the existing shared model.
7. **Capabilities:** climb, swim, boat, fly, protect from cold/heat, read, repair, heal, and
   similar tags supplied by character, role, equipment, or temporary effects.
8. **State:** damage, stamina, conditions, inventory instances, discovery, and progression;
   deliberately deferred until save migrations are designed.

## Rules Philosophy

- Readable checks and explicit requirements are inspired by open tabletop rules.
- Stamina, commitment, load, reach, poise, and build trade-offs are inspired by modern
  deliberate action RPGs.
- Historical material references inform original equipment families and occupations.
- JSON selects registered calculations; content never executes arbitrary code.

The first delta is `@alohayo/character-rules`. It is optional: removing its pack restores
neutral derived/traversal behavior and does not change rendering, movement, saves, or the
existing deterministic character generator.
