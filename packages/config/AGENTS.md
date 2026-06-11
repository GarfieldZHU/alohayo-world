# Config Package Agent Guide

This package owns public contracts. Changes have the widest compatibility cost.

- Prefer additive optional fields during the current major version.
- Definitions are serializable data and never functions.
- Use namespaced stable IDs and explicit schema versions.
- Mirror runtime constraints in content validation.
- Update `docs/CONTENT_GUIDE.md`, examples, and contract tests with every schema change.
