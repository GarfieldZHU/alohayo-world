# Embed Package Agent Guide

This is the stable integration boundary used by external hosts.

- Keep `mountGame` lazy and return only after a valid `GameHandle` exists.
- Resolve assets relative to `assetBaseUrl`; do not assume same-origin hosting.
- Avoid host-global CSS, DOM IDs, and persistent global listeners.
- Preserve cleanup and backward compatibility for optional launch fields.
- Test standalone and remote-host usage before publishing.
