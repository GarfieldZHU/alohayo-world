# Map Package Agent Guide

This package owns deterministic geography and worker-safe data.

- Read `docs/MAP_SYSTEM.md`, `docs/GIS_FOUNDATIONS.md`, and `docs/modules/MAP.md`.
- Keep physical fields, hydrology, landform, ecology, and topology distinguishable.
- Use typed arrays; avoid per-cell objects.
- Iterate neighbors in a documented fixed order.
- Transfer large buffers from workers instead of cloning.
- Update deterministic, connectivity, bounds, and benchmark tests after generator work.
- Rust/Wasm output must have parity tests before becoming authoritative.
