# Character Rules Agent Guide

Read `../../docs/CHARACTER_SYSTEM_BLUEPRINT.md` and
`../../docs/wiki/Character-and-Map-Interactions.md` first.

## Boundary

This package is an optional pure-rules plugin. It may depend on serializable config types.
It must not import PixiJS, DOM APIs, workers, input, persistence, or mutable engine state.

## Rules

- Keep calculations deterministic and side-effect free.
- Accept stable IDs and tags; never inspect localized names or render colors.
- Formulas are data plus registered arithmetic, never executable content.
- Validate all cross-references before creating a registry.
- Empty/absent content must preserve neutral behavior.
- Add English and Simplified Chinese keys before a definition reaches UI.
- Changes to traversal results require focused unit tests for base, mitigated, blocked,
  surface-layer, and ordering behavior.
