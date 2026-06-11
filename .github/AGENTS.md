# GitHub Automation Agent Guide

- Pin third-party actions to immutable commit SHAs.
- Grant minimum workflow permissions and cancel superseded runs.
- CI must validate formatting, lint, types, content, assets, tests, Rust/Wasm, and build.
- Pages deploys `main`; releases package versioned embed artifacts from `v*` tags.
- Do not expose repository or deployment secrets to untrusted pull-request code.
