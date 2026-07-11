# Rust World Core Agent Guide

This crate contains only measured, deterministic hot loops suitable for Wasm.

## Local setup and checks

Read `../../docs/LOCAL_DEVELOPMENT.md` before working in this crate. The required local
toolchain is Rust `1.87.0`, `wasm32-unknown-unknown`, `rustfmt`, `clippy`, and
`wasm-pack` `0.13.1`. `rust-toolchain.toml` is authoritative.

Run these from the repository root after every crate change:

```sh
cargo fmt --manifest-path crates/world-core/Cargo.toml --check
cargo clippy --manifest-path crates/world-core/Cargo.toml -- -D warnings
cargo test --manifest-path crates/world-core/Cargo.toml
yarn build:wasm
test -f dist/embed/wasm/world_core_bg.wasm
```

- Keep the browser worker boundary coarse; do not call Wasm once per cell from JS.
- Avoid nondeterministic collections and platform-dependent behavior.
- Maintain TypeScript parity fixtures before switching production authority to Wasm.
- Keep each exported batch self-contained and typed-array based; document every buffer's
  ownership and validate its length before the worker consumes it.
- Run `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`.
- Document memory ownership and transferred output buffers.
