# Contributing

1. Read `AGENTS.md`, [Local Development Setup](docs/LOCAL_DEVELOPMENT.md), and the architecture decisions.
2. Keep engine behavior deterministic and configuration-driven.
3. Run `yarn format:check && yarn lint && yarn typecheck && yarn validate:content && yarn test`.
4. For Rust/Wasm changes, also run the crate checks and Wasm artifact verification in the local setup guide.
5. Register every asset in `assets/ATTRIBUTION.json`.
6. Add an ADR before changing a foundational architectural decision.
