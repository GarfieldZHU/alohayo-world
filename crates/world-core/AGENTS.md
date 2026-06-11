# Rust World Core Agent Guide

This crate contains only measured, deterministic hot loops suitable for Wasm.

- Keep the browser worker boundary coarse; do not call Wasm once per cell from JS.
- Avoid nondeterministic collections and platform-dependent behavior.
- Maintain TypeScript parity fixtures before switching production authority to Wasm.
- Run `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`.
- Document memory ownership and transferred output buffers.
