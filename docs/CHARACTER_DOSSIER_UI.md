# Wayfinder Dossier UI

**Status:** first playable UI slice

The character interface is a bottom-right character dock for the map-first explorer.
It keeps the live world as the primary surface while giving each open panel enough width
and contrast to be read comfortably. Panels remain independent rather than becoming a
full-screen dashboard.

## Visual direction

The dossier extends the existing JRPG UI system in `JRPG_UI_SYSTEM.md`:

- smoky navy and translucent vellum surfaces over the map;
- teal for focus and interactive affordances;
- brass for selected, equipped, and confirmed states;
- serif titles with system-sans body text and compact monospace metadata;
- one-pixel separators, contour-line gradients, and restrained shadows;
- a stable translucent backing with blur and a deep fallback color for readable text over
  the moving map;
- authored material textures used as low-opacity surface grain rather than a bitmap skin;
- no looping decoration or texture-driven motion.

The generated reference image is a mood and hierarchy reference. The runtime adds two
project-local material assets—`assets/wayfinder-slate-texture.png` and
`assets/wayfinder-vellum-texture.png`—through scoped CSS. Slate sits behind interactive
ability and item records; vellum marks point allocation and archival summaries. Both are
veiled by gradients so the texture adds tactile depth without reducing text contrast.

## Detailed ability/items surface

The `I` entry point opens the Ability ledger as a real reading surface rather than a
single simplified list:

- a vellum point-reserve plate shows remaining points, preview status, segmented reserve,
  allocated points, ability count, and group count;
- abilities are grouped into Physical, Mental, Social, and Fortune sections using the
  catalog's `group` field; each record has a segmented 1–20 scale, preview highlights,
  description, and keyboard-safe point steppers;
- the Equipment rack has a generated-loadout section with item glyphs, slot selectors,
  active weapon state, tags, and modifier summaries;
- the same surface includes a field item catalog sourced from the real content item
  definitions, with tags, shareability, allowed-slot count, appearance tint, and an
  explicit catalog-only boundary until inventory ownership exists;
- all cards can still be independently collapsed or closed, and the rail remains the
  compact way to restore a sibling panel.

This is deliberately denser than the Chronicle. The map remains visible outside the dock,
while the dock's internal reading plane owns its own scroll so detail does not become
unreadable or push the game surface away.

## Panel model

The dossier has five independent panels:

| Panel                    | Purpose                                            | First-slice authority                                                       |
| ------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------- |
| Wayfinder record         | identity and current world state                   | generated character, motion, terrain snapshot                               |
| Ability ledger           | spend custom points after a level-up               | explicit local preview points; not persisted progression yet                |
| Equipment rack           | inspect the generated loadout and active weapon    | generated slots/items; selection changes are local preview actions          |
| Skills and proficiencies | show actions and known capability tags             | configured actions, abilities, and character tags; no invented skill levels |
| Field systems            | show exploration consequences and system readiness | position, terrain, discovery, movement, and explicit unavailable rules      |

The dossier starts closed. `C` opens or closes it. While it is open, the number keys target
specific panels. A vertical reopen rail remains visible whenever the dossier is open.
Every panel has its own collapse and close controls. Closing a panel never closes its
siblings, and every closed panel can be restored from the rail.

## Input and layout contract

- `C`: open or close the character dossier.
- `I`: open the Ability ledger directly, including the equipment and item records reachable
  from the dossier rail.
- `1`: open the Wayfinder record.
- `2`: open the Ability ledger.
- `3`: open the Equipment rack.
- `4`: open Skills and proficiencies.
- `5`: open Field systems.
- `Escape`: close the focused sub-panel first; when focus is outside a panel, close the
  dossier. When no surface is active, `Escape` opens Settings.
- `M`: open the Field map journal section.
- `H`: toggle the HUD.
- `N`: toggle the field map/minimap.
- `Tab`, arrows, `Enter`, and `Space`: use native DOM focus and activation inside panels.
- Opening the dossier does not pause movement. Text fields retain typing behavior and
  DOM controls consume their own focused keys.
- Desktop uses a larger bottom-right dock capped near 45vw / 560px and 68% of the host
  height. The map's center and lower-middle remain clear.
- Small screens use a bottom sheet capped near 62% of the viewport height; panel headers
  remain horizontally reachable and the map stays playable above it.
- Panel replacement does not replay an arrival animation, so ability/equipment changes do
  not flash the reading surface. `prefers-reduced-motion` still removes non-essential
  transitions.

## Data boundary

The UI consumes a read-only `GameUiSnapshot`. Generated abilities, appearance, equipment,
actions, position, terrain, discovery, and movement values are authoritative. Ability point
allocation is intentionally labelled as a local preview until progression and save contracts
exist. The optional character-rules pack remains outside the live renderer; field systems
show its unavailable state rather than inventing survival meters.

## Acceptance checks

- The map remains visually dominant in closed, record, and multi-panel screenshots.
- Every panel independently opens, collapses, closes, and reopens.
- `C`, `I`, `1`–`5`, `Escape`, `M`, `H`, and `N` do not leak into movement or camera input.
- English and Simplified Chinese labels remain legible at desktop and mobile widths.
- Equipment and ability interactions visibly update their local preview state.
- Ability values, descriptions, meters, and steppers remain readable at the larger dock size.
- Panel backgrounds stay translucent enough to preserve the map while retaining a dark
  contrast backing for text.
- Slate and vellum texture assets remain below the contrast veil and load through the
  Vite asset graph rather than a network URL.
- Values are authoritative or explicitly marked as preview/unavailable.
- `GameHandle.destroy()` removes the dossier and its listeners with the rest of the game UI.
- Browser smoke tests cover the closed state, each panel, keyboard shortcuts, and mobile layout.
