# Weapons, Armor, and Items

Equipment is defined by families and tags. Visual assets, named instances, quality,
durability, and affixes layer on later; core rules do not hard-code a specific sword or
armor set.

## Weapon Families

- jian: balanced double-edged sword, precision and adaptable reach;
- dao: single-edged blade, committed cuts and practical field use;
- qiang: spear family, reach and formation control;
- gun: staff family, control, low material cost, non-edge techniques;
- bow and crossbow: ranged pressure with ammunition and terrain sightlines;
- axe and hammer tools: high impact, utility, and greater stamina commitment;
- unarmed and short weapons: low load, close range, concealment or backup use.

Each family declares requirements, ability scaling, grip, weight, reach, stamina cost,
damage tags, and proficiency tags. Requirements affect effectiveness; they do not mutate
the character's base abilities.

## Armor Profiles

Travel cloth, lacquered leather scale, iron lamellar, and ceremonial-heavy profiles form
the first original data set. Armor trades weight and noise for poise, protection, and
environmental resistance. Historical references guide materials and construction, while
game statistics remain original abstractions.

## Item Categories

Remedies, provisions, tools, ammunition, ritual objects, documents, and crafting
materials are first-class categories. Items may grant capability tags such as
`traversal:climb`, `protection:cold`, `knowledge:river`, or `tool:repair`; systems consume
tags through registries rather than importing item implementation code.
