# Character Package Agent Guide

This package provides deterministic character creation shared by players, NPCs, and
enemies.

- Read `docs/modules/CHARACTERS.md` and `docs/config/CHARACTERS.md`.
- Keep abilities, appearance pools, slots, item pools, and archetypes configurable.
- Never special-case a role in generation when an archetype field can express it.
- New ability IDs must work without changing the generator.
- Fixed selections override pools; shared equipment remains an item/content concern.
- Character generation must be deterministic for `(archetype, seed, content version)`.
- Add tests for new selection rules and invalid references.
