# Character and Map Interactions

> **Wiki page version:** EN 1.1.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-23
> **中文:** [角色与地图交互](Character-and-Map-Interactions-zh-CN) · **Translation status:** synced with EN 1.1.0

Terrain interaction is a pure query over stable terrain IDs, active surfaces, structures,
weather, character roles, body state, and equipment capabilities. It returns movement,
stamina, control, exposure, entry, and hazard results. Rendering and input do not own
these rules.

## Composition Order

1. Base terrain supplies material, slope, roughness, exposure, and traversal facts.
2. Hydrology/topology supplies water body, river crossing, depth, flow, and shoreline.
3. Weather and surfaces add rain, mud, snow, ice, heat, wind, flood, ash, or decay.
4. Roads/bridges/ferries/buildings add route or shelter capabilities without rewriting
   underlying terrain.
5. Body, role, equipment, mount, vehicle, and temporary effects grant capabilities and
   mitigation.
6. Character rules return costs, control, exposure, hazards, and matched rule IDs.
7. Movement, AI, action, combat, survival, and settlement systems consume that result.

This prevents equipment from rewriting the map and prevents the renderer from becoming a
physics authority.

## Equipment Capability Adapter

`@alohayo/character-rules` exposes `evaluateCharacterTerrainTraversal` as the small,
pure bridge between a character loadout and terrain rules. It gathers only declared item
tags, then delegates to the same deterministic traversal evaluator used by AI and tests.
For example, an equipped item tagged `traversal:boat` can satisfy the open-water rule;
boots, ropes, insulation, and future mounts use the same data path.

The adapter does not mutate inventory, generate UI, or grant hidden abilities. Content
packs own item schemas and may be enabled or removed independently. This keeps the
character system a reversible plugin while preserving a stable terrain interaction
contract.

## Representative Outcomes

- Marsh raises movement and stamina cost and reduces control. Waterproof boots and a
  river-warden role mitigate specific penalties; a causeway can provide a route.
- Snowfield/glacier add cold and traction risk. Insulation reduces exposure, crampon-like
  equipment improves control, and glacier entry may still require skill/rope support.
- Mountains reward climbing capability and pass knowledge. A maintained pass can
  supersede local movement cost without flattening the mountain terrain.
- Rivers block ordinary crossing unless depth/flow allows a ford or a bridge, ferry,
  swimming, boat, amphibious, or flight capability applies.
- Open/deep ocean require watercraft, powerful swimming/amphibious capability, or flight;
  weather and load may invalidate an otherwise valid capability.
- Desert travel combines heat, time of day, wind, surface, carried water, clothing, and
  route knowledge. Terrain rules produce exposure; survival state applies harm/supplies.
- Roads accelerate compatible movement but wet, muddy, snowy, slushy, flooded, damaged,
  congested, or poorly maintained conditions reduce the bonus.

## Visibility and Battle Shadow

Discovery memory, current vision, physical line of sight, and battle-shadow legality are
related but distinct. Fog presentation may be smooth/sub-cell, while gameplay queries use
continuous frontier geometry and obstacles. Future skills declare whether they require
visible target, discovered location, unobstructed path, or may continue into shadow.

## Flight

Dev flight is a debugging bypass. Real flight must come from equipment, creature body,
mount, vehicle, technique, or temporary effect and account for load, wind, altitude,
weather, stamina/focus, landing space, and visibility. It bypasses ground collision but
does not make hazards, costs, or world boundaries meaningless.

## Determinism and Diagnostics

Queries are pure and ordered by stable priority. Results include matched rule IDs so UI,
AI, tests, and developer tools can explain why movement slowed or entry failed. Random
hazards use explicit seeded context, never renderer frame timing.
