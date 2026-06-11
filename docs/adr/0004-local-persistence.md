# ADR 0004: Local persistence

Small preferences use namespaced localStorage. Chunked game saves use IndexedDB from
v0.2. Every save carries schema, engine, and content versions and never leaves the
device.
