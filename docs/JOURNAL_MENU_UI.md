# Journal Menu UI

The Adventurer's Chronicle is the game's map-first reference surface. It pauses
movement while open, but keeps a visible perimeter of the field map on desktop and
becomes a safe-area-aware single scroll surface on narrow screens.

## Information architecture

The journal has six independent sections. Each section is a complete reading surface;
the rail only changes which one is visible.

| Section        | Shortcut | Authority                                    | Purpose                                                                                        |
| -------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Save           | `1`      | versioned local save snapshot                | write a named manual progress marker and show save health                                      |
| Guide          | `2`      | movement/action/UI contracts                 | tour controls, journal shortcuts, and a link to the character dossier                          |
| Terrain manual | `3`      | loaded `BiomeDefinition` catalog             | names, descriptions, family, movement/road costs, occurrence, habitat tags, and iconic species |
| Bestiary       | `4`      | enemy archetype and biome ecology references | show catalog references without claiming an encounter ledger exists                            |
| Field map      | `5`      | streamed chunks and discovery counters       | current position, region, terrain, coverage, loaded landmarks, and seed                        |
| Settings       | `6`      | live HUD/map configuration                   | toggle field HUD and field map, with the control reference kept nearby                         |

Legacy `GameUiTab` values (`journey`, `party`, and `gear`) remain accepted as aliases so
embedders do not break; they open the Guide section. Detailed abilities, equipment,
skills, and field systems stay in the independently collapsible character dossier.

## Visual and interaction rules

- The desktop frame is capped at 720px and centered inside the game surface, while also
  respecting the dynamic viewport and host surface; long content cannot push the folio
  above or below the map.
- A left rail and one active reading plane keep the hierarchy closer to a field folio
  than a dashboard.
- The rail uses direct brass glyphs rather than circular icon containers, restrained
  selection lines, smoky navy surfaces, teal focus, and serif section headings from the
  JRPG UI system.
- Bestiary reference cards use kind-specific field-record accents, layered contour/compass
  details, and a restrained hover lift/glow. These effects are presentation-only; the cards
  remain truthful reference entries and do not imply encounter history.
- The left rail is a fixed-height navigation blade with no vertical scroll. Only the active
  right reading plane scrolls independently, so long terrain and ecology references do not
  stretch the outer modal or move the playfield behind it.
- Mobile switches the rail to a fixed-height horizontal tab strip and keeps every button at
  a touchable size. The active panel remains the only scrollable reading surface.
- `M` or `Esc` closes the journal. `Q`/`E`, arrows, `Home`, and `End` move sections;
  `Tab` remains the focus loop. Opening the journal clears held gameplay keys.

## Truthful data boundary

The Save section calls the engine's existing `saveNow()` path and never places a raw save
snapshot in the DOM. The Guide is contract-backed copy. Terrain content currently comes
from the runtime biome catalog; the detailed `terrain-rules.json` material rules remain a
follow-up to wire through the content-pack runtime.

The Bestiary labels enemy archetypes and biome wildlife as references only. The creature
module does not yet own encounter history, first-seen records, or persisted observations,
so the journal does not mark the Shore Raider or any species as encountered.

## Follow-up TODOs

- Wire the terrain-rule pack into resolved runtime content and add localized material,
  hazard, entry, surface-effect, and transformation details to each manual entry.
- Add a versioned journal ledger for observed terrain, charted/inspected landmarks, and
  player-authored notes; until then use “charted”, “nearby”, and “reference”.
- Implement the deferred creature/encounter module with localized species definitions,
  first-seen records, encounter counts, and save migration before expanding Bestiary claims.
- Add the remaining save-manager actions (load, rename, duplicate, backup restore,
  import/export, and clear) as collapsible journal sections once the in-game interaction
  contract is designed.
