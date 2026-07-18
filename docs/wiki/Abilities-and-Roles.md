# Abilities and Roles

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [能力与身份](Abilities-and-Roles-zh-CN) · **Translation status:** synced with EN 1.0.0

Abilities describe broad potential; roles describe learned context. Neither is a rigid
class. Catalog-driven iteration lets content packs add stable ability or role IDs without
editing a central switch statement.

## First Eight Abilities

| Ability      | Primary meaning                                  | Example consumers                                     |
| ------------ | ------------------------------------------------ | ----------------------------------------------------- |
| strength     | force, lifting, heavy handling, impact           | load, weapon requirements, forced movement            |
| agility      | balance, fine motion, evasion, precision         | control, recovery, climbing, handling                 |
| endurance    | sustained effort and exposure resistance         | vitality, stamina, cold/heat tolerance                |
| intelligence | analysis, engineering, memory, techniques        | crafting, research, complex actions                   |
| perception   | detection, navigation, ranged awareness          | visibility, traps, tracking, aim                      |
| willpower    | concentration, fear resistance, ritual endurance | focus, resolve, interruption resistance               |
| charisma     | persuasion, leadership, social reading           | negotiation, morale, reputation interactions          |
| luck         | narrow uncertainty modifier                      | rare outcomes and tie-breakers, never universal power |

## Derived Resources

Resources use declared weighted sums:

`value = round(base + Σ ability[id] × weight[id])`

The initial resources are vitality, stamina, focus, poise, load, and resolve. These are
capacity calculations. Mutable spending, damage, recovery, and conditions belong to
later action/combat/survival state and must be saved explicitly.

## Background Roles

| Role            | Geographic relationship     | Initial strengths                  |
| --------------- | --------------------------- | ---------------------------------- |
| Wayfinder       | mixed frontier              | navigation, campcraft, observation |
| River warden    | rivers, deltas, wetlands    | boats, ropes, flood reading        |
| Pass sentinel   | mountains and roads         | endurance, polearms, route defense |
| Archive scholar | towns and ruins             | documents, languages, analysis     |
| Field physician | settlements and expeditions | remedies, diagnosis, exposure care |
| Craft artisan   | mines, forests, towns       | repair, materials, tools           |
| Caravan courier | roads and deserts           | logistics, riding, negotiation     |
| Ritual adept    | sacred and dangerous sites  | focus, resolve, local rites        |

A role supplies ability priorities, proficiency tags, terrain affinities, and starting item
tags. It may affect social recognition and available teachers later, but never prevents a
character from learning another discipline.

## Checks and Proficiency

A future check consumes an ability, optional proficiency, difficulty, situational
modifiers, and deterministic/random context. Terrain familiarity can mitigate a specific
cost but does not erase physical barriers. Knowledge tags unlock interpretations and
actions rather than providing unexplained numeric bonuses everywhere.

## Extension Rules

New abilities need stable IDs, bounds, localization, validation, and explicit formula
weights. New roles need geography, proficiencies, item tags, and cultural context. Avoid
roles that are merely combat loadouts or one-dimensional ethnic stereotypes.
