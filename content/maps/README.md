# Map Config Folder

Every JSON file matching `content/maps/**/areas/*.json` is discovered automatically by
the Vite build and applied after procedural geography. No TypeScript registration is
required.

Start with `core/areas/wayfinder-isle.json` and read `docs/config/MAPS.md` before adding
an area. Keep pack indexes beside their `areas/` directory to document load order and
future dependency metadata.

Run:

```sh
yarn validate:content
yarn test
yarn build
```
