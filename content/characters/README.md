# Character Config Folder

`core/` contains abilities, appearance pools, equipment slots, items, item pools, and
archetypes shared by players, NPCs, and enemies.

Read `docs/config/CHARACTERS.md` before editing. New abilities and archetypes are data
additions; the deterministic generator iterates the catalogs rather than hard-coding the
eight core stats.

`extensions/eastern-frontier-v1/` is an optional, reversible character-rules pack. It
adds derived resource formulas, background roles, equipment families, item categories,
and terrain interactions without changing the core generator or live runtime. Read
`docs/CHARACTER_SYSTEM_BLUEPRINT.md` and `packages/character-rules/AGENTS.md` first.
