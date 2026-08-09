# Wayfinder Dossier UI

**Status:** first playable UI slice

The character interface is a right-docked field dossier for the map-first explorer.
It keeps the live world as the primary surface and exposes character information as
small, independently managed panels rather than a full-screen dashboard.

## Visual direction

The dossier extends the existing JRPG UI system in `JRPG_UI_SYSTEM.md`:

- smoky navy and translucent vellum surfaces over the map;
- teal for focus and interactive affordances;
- brass for selected, equipped, and confirmed states;
- serif titles with system-sans body text and compact monospace metadata;
- one-pixel separators, contour-line gradients, and restrained shadows;
- no bitmap skin or looping decoration.

The generated ImageGen concept is a mood and hierarchy reference only. The runtime uses
scoped CSS so the map remains readable and embeds do not inherit host styles.

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
- `1`: open the Wayfinder record.
- `2`: open the Ability ledger.
- `3`: open the Equipment rack.
- `4`: open Skills and proficiencies.
- `5`: open Field systems.
- `Escape`: close the focused sub-panel first; when focus is outside a panel, close the
  dossier. `M` opens the full game menu when no surface is active.
- `M`: open or close the full game menu.
- `H`: toggle the HUD.
- `N`: toggle the field map/minimap.
- `Tab`, arrows, `Enter`, and `Space`: use native DOM focus and activation inside panels.
- Opening the dossier does not pause movement. Text fields retain typing behavior and
  DOM controls consume their own focused keys.
- Desktop uses a stable right dock capped near one-third of the viewport width. The map's
  center and lower-middle remain clear.
- Small screens use a bottom sheet capped near 58% of the viewport height; panel headers
  remain horizontally reachable and the map stays playable above it.
- `prefers-reduced-motion` removes the arrival transform and shortens transitions.

## Data boundary

The UI consumes a read-only `GameUiSnapshot`. Generated abilities, appearance, equipment,
actions, position, terrain, discovery, and movement values are authoritative. Ability point
allocation is intentionally labelled as a local preview until progression and save contracts
exist. The optional character-rules pack remains outside the live renderer; field systems
show its unavailable state rather than inventing survival meters.

## Acceptance checks

- The map remains visually dominant in closed, record, and multi-panel screenshots.
- Every panel independently opens, collapses, closes, and reopens.
- `C`, `1`–`5`, `Escape`, `M`, `H`, and `N` do not leak into movement or camera input.
- English and Simplified Chinese labels remain legible at desktop and mobile widths.
- Equipment and ability interactions visibly update their local preview state.
- Values are authoritative or explicitly marked as preview/unavailable.
- `GameHandle.destroy()` removes the dossier and its listeners with the rest of the game UI.
- Browser smoke tests cover the closed state, each panel, keyboard shortcuts, and mobile layout.
