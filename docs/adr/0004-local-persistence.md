# ADR 0004: Local persistence

Small preferences use namespaced localStorage. Chunked game saves use IndexedDB from
v0.2. Every save carries schema, engine, and content versions and never leaves the
device.

Current implementation details:

- IndexedDB stores a default `autosave` snapshot under the local device profile.
- snapshots include world identity, content-pack save metadata, explorer state,
  discovery masks, and selected runtime preferences;
- import/export uses the same JSON snapshot contract;
- unsupported schema versions fail through the migration registry instead of attempting
  partial recovery;
- content-pack resolution hashes gate restore/import compatibility so stale saves do not
  silently apply to different content.

Future work remains for multi-slot save browsers, richer recovery UI, and chunk-history
compression, but those build on the same snapshot contract rather than replacing it.
