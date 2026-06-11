# ADR 0003: Selective Rust and WebAssembly

Rust/Wasm owns deterministic, profiled CPU-heavy generation and pathfinding. TypeScript
owns orchestration, rendering, UI, and plugins. A deterministic TypeScript fallback
keeps startup resilient and simplifies browser debugging.
