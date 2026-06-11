# Test Agent Guide

- Deterministic tests use explicit seeds, dimensions, and generator versions.
- Prefer behavioral contracts over snapshots of incidental rendering details.
- Map changes need topology/code validity tests and benchmark coverage.
- Embed changes need lazy-loading and cleanup E2E coverage.
- Keep benchmark thresholds broad enough for CI variance but sensitive to regressions.
