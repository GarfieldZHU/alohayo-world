# ADR 0004: Local persistence

Small preferences use namespaced localStorage. Chunked game saves use IndexedDB from
v0.2. Every save carries schema, engine, and content versions and never leaves the
device.

Current implementation details:

- IndexedDB stores a default `autosave` plus named manual and imported snapshots under
  the local device profile.
- snapshots include world identity, content-pack save metadata, explorer state,
  discovery masks, and selected runtime preferences;
- import/export uses the same JSON snapshot contract;
- unsupported schema versions fail through the migration registry instead of attempting
  partial recovery;
- content-pack resolution hashes gate restore/import compatibility so stale saves do not
  silently apply to different content.
- the standalone save inspector supports list, save, load, rename, duplicate, delete,
  import, and export with visible typed recovery failures;
- replacing a slot stores up to three rolling previous versions in the same local record;
- record listing validates each primary independently so one damaged save cannot hide
  healthy journeys;
- lightweight summaries expose seed, explorer position, discovery, engine version,
  approximate serialized size, health, and backup count without decoding render buffers;
- backup restoration is an explicit user action, and quota retries prune oldest backups
  first before returning a typed failure.
- runtime load and backup recovery first run a read-only compatibility report. A matching
  world loads directly, seed/preset differences return a `remountable` result for the
  launcher to confirm, and content-resolution or chunk-size differences remain hard
  incompatibilities. Target chunks are fetched before restore mutation. The launcher writes
  a temporary recovery slot before remounting, restores the previous world after a failed
  mount/load, and keeps the recovery slot when rollback cannot be completed.
- replacing a save, rename target, duplicate target, single import, or archive record requires
  an explicit confirmation; archive imports use schema version 1, cap records at 64, and
  report malformed, duplicate, cancelled, and rejected records independently.
- save journey cards expose compact metadata and keyboard selection while a best-effort
  `navigator.storage.estimate()` status remains advisory and never gates saves.

Future work remains for optional visual thumbnails and chunk-history compression. These build
on the same snapshot/backup contract rather than replacing it; issue #62 tracks the benchmarks,
versioned compression, and asynchronous thumbnail phases without weakening the bounded archive
and recovery guarantees delivered by #43/#54.
