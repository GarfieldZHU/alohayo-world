# Config Package Agent Guide

This package owns public contracts. Changes have the widest compatibility cost.

- Prefer additive optional fields during the current major version.
- Definitions are serializable data and never functions.
- Use namespaced stable IDs and explicit schema versions.
- Mirror runtime constraints in content validation.
- Update `docs/CONTENT_GUIDE.md`, examples, and contract tests with every schema change.
- Locale IDs, supported-language registries, and translation helper signatures belong
  here when they affect public runtime integration.
- World clock, day/night phase, and future calendar contracts belong here before engine
  code consumes them.
- Content-pack manifests, dependency metadata, overlay provenance contracts, and future
  migration registry shapes belong here before map or engine code consume them.
