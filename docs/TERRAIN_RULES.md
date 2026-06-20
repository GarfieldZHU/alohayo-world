# Terrain Rules

`content/core/terrain-rules.json` is the authoritative material and physics guide for
terrain behavior. `content/core/biomes.json` owns IDs, numeric codes, palette, movement
cost, road cost, creature tags, settlement score, and generation ranges. `i18n/en.json`
and `i18n/zh-CN.json` own player-facing names and descriptions.

Every terrain must have all three:

1. a biome definition in `content/core/biomes.json`;
2. a rule entry in `content/core/terrain-rules.json`;
3. English and Simplified Chinese names in `i18n/`.

`yarn validate:content` and `tests/world.test.ts` enforce that contract.

## Terrain Versus Landform

The reference image mixes terrain/ecology classes with landforms. Alohayo World keeps
these separate so AI agents and gameplay systems can reason clearly:

- Terrain/biome: cell material and ecology, such as ocean, coast, forest, desert,
  plateau, volcano, and glacier.
- Topology: connected-water and connected-land identity, such as ocean body, lake,
  mainland, and island.
- Landform/feature overlay: shapes that cross terrain cells, such as bay, gulf,
  strait, channel, river, waterfall, delta, basin, cave, peninsula, cape, valley, cliff,
  and archipelago.

Today the 26 core terrain IDs below are implemented as cell terrain. Some image labels
are already represented through topology or features: `lake`, `mainland`, and `island`
come from topology; `canyon` covers canyon/valley gameplay for now; `reef` covers coral
reef and lagoon-adjacent water. `river` remains a generated linear overlay rather than a
cell terrain so it can cross plains, basins, forests, and roads without duplicating the
underlying biome. The remaining landforms should be implemented as feature overlays in
`v0.2+`, not as duplicate biomes.

## Core Terrain Rules

The JSON rule pack contains the full text for real-world description, Alohayo behavior,
generation possibility, generation conditions, surface effects, physical movement and
hazards, and destruction/transformation rules. This table is the quick index.

| Terrain ID         | English        | 中文     | Rarity    | Typical Conditions                                       | Gameplay Notes                                                |
| ------------------ | -------------- | -------- | --------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `core:deep-ocean`  | Deep Ocean     | 深海     | common    | very low elevation, edge-connected water, far from coast | foot-blocking barrier; ships, flight, or water magic required |
| `core:ocean`       | Open Ocean     | 远洋     | common    | low edge-connected water beyond shallows                 | navigation space with storms, currents, and sea encounters    |
| `core:shallow-sea` | Shallow Sea    | 浅海     | common    | water slightly below sea level near land                 | small-boat, reef, shoal, and sediment transition terrain      |
| `core:reef`        | Coral Reef     | 珊瑚礁   | rare      | warm shallow sea, low depth, seeded reef chance          | bright high-life water; dangerous for careless boats          |
| `core:lake`        | Lake           | 湖泊     | uncommon  | inland basin water disconnected from edge ocean          | freshwater hub; boats needed; can drain to wetland/lowland    |
| `core:coast`       | Coast          | 海岸     | common    | near sea level, touches water, gentle margin             | ports, beaches, tidal effects, good roads unless flooded      |
| `core:beach`       | Beach          | 海滩     | uncommon  | low-slope sandy shore with moderate warmth               | softer landing shore; slower than compact coast roads         |
| `core:basin`       | Basin          | 盆地     | uncommon  | enclosed low plain ringed by higher ground               | fertile bowl terrain with flood and wetland transition risk   |
| `core:lowland`     | Lowland Plain  | 低地平原 | common    | low relief, moderate moisture and temperature            | fastest wild travel and best town/farm/road terrain           |
| `core:grassland`   | Grassland      | 草原     | common    | moderate land where forest/desert do not dominate        | fast travel, herds, fire risk, easy mounted movement          |
| `core:forest`      | Forest         | 森林     | common    | moist temperate land                                     | slower, dense, resource-rich, reduced visibility              |
| `core:rainforest`  | Rainforest     | 雨林     | rare      | hot, very wet, low to mid elevation                      | slow, high biomass, disease/ambush risk                       |
| `core:savanna`     | Savanna        | 稀树草原 | uncommon  | hot with seasonal moderate moisture                      | fast open travel, fire and heat risk                          |
| `core:desert`      | Desert         | 沙漠     | uncommon  | hot, very dry, rain shadow or arid belt                  | loose sand, heat, thirst, sandstorms                          |
| `core:oasis`       | Oasis          | 绿洲     | rare      | seeded groundwater in desert climate                     | refuge, settlement node, contested water                      |
| `core:wetland`     | Wetland        | 湿地     | uncommon  | low, saturated, near water                               | slow mud, causeways, disease and flood risk                   |
| `core:marsh`       | Marsh          | 沼泽     | rare      | very wet warm lowland                                    | very slow, reeds, sink mud, boat/causeway useful              |
| `core:tundra`      | Tundra         | 苔原     | uncommon  | cold land, limited tree growth                           | moderate frozen travel, slow thaw, cold exposure              |
| `core:snow`        | Snowfield      | 雪原     | uncommon  | high cold land with snow moisture                        | slow, slippery, whiteout and cold hazards                     |
| `core:glacier`     | Glacier        | 冰川     | very-rare | very cold, wet, high elevation                           | ice barrier, crevasses, sliding, strong gear needs            |
| `core:highland`    | Highland       | 高地     | common    | elevated broken terrain below alpine peaks               | slower than plains, passes matter, wind/cold rain             |
| `core:plateau`     | Plateau        | 高原     | rare      | high elevation with low ruggedness                       | broad elevated travel, dangerous scarps                       |
| `core:canyon`      | Canyonlands    | 峡谷荒原 | rare      | rugged dry elevated terrain                              | maze-like choke points, cliffs, flash floods                  |
| `core:bare-rock`   | Bare Rock      | 裸岩     | uncommon  | dry or rugged highland, thin soil                        | mineral terrain, scree/ice hazards, slow travel               |
| `core:mountain`    | Mountain       | 高山     | uncommon  | very high, rugged relief                                 | major barrier; passes, cold, falls, rockfall                  |
| `core:volcano`     | Volcanic Field | 火山地   | very-rare | high rugged hotspot terrain                              | heat, ash, gas, lava, unique resources                        |

## Surface Effects

Surface effects are temporary visual/gameplay layers on top of terrain. They should not
replace the underlying terrain ID unless a long-term transformation rule says so.

Examples:

- water on coast creates `wet-sand`;
- water on beach creates `wet-sand` and dune-edge wash;
- rain on lowland or roads creates `mud`;
- snow on forest creates `snow-laden-canopy`;
- heat on glacier creates melt and can eventually transform it to snow or lake;
- fire on grassland creates a burn scar and may later recover or degrade.

Future weather, spells, construction, and disasters should add or decay surface layers
first, then apply a terrain transformation only when the rules say the underlying
material has changed.

## Dev Terrain Showcase

`content/maps/core/areas/terrain-showcase.json` is disabled by default. It places all
26 terrain IDs near the streamed origin for visual, movement, road, weather, and i18n
testing. Launchers can activate it with:

```ts
mountGame({
  container,
  devMode: true,
  initialWorld: {
    seed: 'terrain-showcase',
    mapAreaIds: ['core:terrain-showcase'],
  },
})
```

Do not enable this area globally; it is a test fixture, not canonical world geography.

## Rivers

Rivers are not stored as a standalone terrain ID. They are generated as an overlay path
from inland high/moist sources toward lakes or the sea, then rendered and collision-checked
on top of the base biome.

- They can cross lowland, basin, grassland, forest, canyon floor, or coastal terrain.
- They block normal foot movement unless a road crossing produces a bridge overlap.
- They should inform future wetlands, deltas, floodplains, fisheries, mills, and town siting.
