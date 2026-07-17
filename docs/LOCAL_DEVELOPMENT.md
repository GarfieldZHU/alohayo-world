# Local Development Setup

This project has a TypeScript reference path and a Rust/WebAssembly acceleration path.
Install both before changing map generation, rendering preparation, or the worker protocol.

## Required tools

- Node version from `.nvmrc` and Corepack/Yarn version from `package.json`.
- Rust `1.87.0` from `rust-toolchain.toml`.
- Rust target `wasm32-unknown-unknown`.
- Rust components `rustfmt` and `clippy`.
- `wasm-pack` `0.13.1`.

On macOS, install Xcode Command Line Tools first if `clang` is unavailable:

```sh
xcode-select --install
```

Install the pinned Rust toolchain with the official bootstrapper, then install the Wasm
packager:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.87.0
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown --toolchain 1.87.0
rustup component add rustfmt clippy --toolchain 1.87.0
cargo install wasm-pack --version 0.13.1 --locked
```

On Apple Silicon, `wasm-pack` may not find a prebuilt `wasm-bindgen` binary. If its
fallback installer fails because a host dependency requires a newer compiler, install
the matching host CLI with an already-installed current stable toolchain:

```sh
cargo +stable install wasm-bindgen-cli --version 0.2.126 --locked
```

This does not change `rust-toolchain.toml`: the host CLI may use current stable Rust,
while the `world-core` crate still compiles and tests with pinned Rust `1.87.0`. Keep the
CLI version equal to the crate's resolved `wasm-bindgen` version in
`crates/world-core/Cargo.lock`.

Add `$HOME/.cargo/bin` to your shell startup file if it is not already present. Verify the
tooling from the repository root:

```sh
cargo --version
rustup target list --installed
wasm-pack --version
```

## Install and run

```sh
corepack enable
yarn install --immutable
yarn dev
```

Use `yarn build:wasm` to compile the Rust crate into `dist/embed/wasm/`. A successful
build creates `world_core.js` and `world_core_bg.wasm`; `README.txt` means the TypeScript
fallback was used instead and is not sufficient for validating a Wasm migration.

## Full local verification

Run this before handing off a Rust/Wasm change:

```sh
yarn format:check
yarn lint
yarn typecheck
yarn validate:content
yarn validate:assets
yarn build:wasm
test -f dist/embed/wasm/world_core.js
test -f dist/embed/wasm/world_core_bg.wasm
yarn test
cargo fmt --manifest-path crates/world-core/Cargo.toml --check
cargo clippy --manifest-path crates/world-core/Cargo.toml -- -D warnings
cargo test --manifest-path crates/world-core/Cargo.toml
yarn build
yarn check:perf
```

Use `yarn test:e2e` after a browser-facing worker or embed change. It requires the local
Playwright browsers; install them once with `yarn playwright install`. If the download is
unavailable but Chrome is already installed, point Playwright at it explicitly:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" yarn test:e2e
```

## Wasm migration rules

- Keep TypeScript as a deterministic reference until a cross-language parity fixture
  passes for every migrated batch.
- Call Wasm only from the map worker and only with coarse typed-array batches. Never call
  it once per cell from the main thread.
- PixiJS drawing, DOM UI, input, and `GameHandle` lifecycle ownership stay in TypeScript.
- Keep the fallback path operational for missing/failed Wasm assets, but make Pages and
  releases verify that the expected artifacts are present.
- Record a benchmark before changing production authority; faster code that changes a
  world hash is a regression.
