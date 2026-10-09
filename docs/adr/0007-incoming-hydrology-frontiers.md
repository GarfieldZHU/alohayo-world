# ADR 0007: Provisional incoming hydrology frontiers

## Status

Accepted for the retained hydrology graph schema version 2.

## Context

Each streamed chunk computes hydrology over a deterministic world-coordinate halo and keeps
the chunk interior. The halo can contain a D8 edge that flows into the retained chunk even
when its source chunk is not loaded. Omitting that edge makes an incoming river appear to
start at the loaded horizon. Treating the halo as globally authoritative would overstate what
the finite raster proves.

## Decision

- Store each halo-derived edge entering the chunk interior as a `DrainageFrontierInflow` with
  source and target world coordinates, D8 direction, and source accumulation.
- Sort and bound the records by chunk perimeter. When pair reconciliation changes an interior
  seam patch, replace only inflow records whose targets lie inside that patch.
- Emit a coordinate-stable `river:segment:<source>><target>` graph segment with
  `sourceKind: 'frontier'` while the source raster is not retained. Resolve its watershed
  identity from the retained target cell.
- Suppress the virtual segment when the source cell is retained; the raster-derived segment
  uses the same coordinate ID. After eviction, the provisional halo link can return and uses
  persisted canonical watershed aliases.
- Keep the incoming link provisional. The deterministic halo and retained graph do not prove
  global hydrology beyond their sampled bounds.
- Version `WorldRiverGraphSnapshot` as schema 2 because `sourceKind: 'frontier'` extends the
  public segment contract.

## Consequences

Consumers can display and query a river crossing the loaded upstream horizon without
mistaking the frontier for a source or mouth. The link remains bounded and deterministic for
the available halo and retained chunks. Future global hydrology or split-event work must
extend this contract without treating provisional frontiers as confirmed world outlets.
