# Wiki Versioning

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [Wiki 版本管理](Wiki-Versioning-zh-CN) · **Translation status:** synced with EN 1.0.0

English is the editorial source language. Simplified Chinese is a first-class translation,
but its version is tracked separately so readers can see when it trails the source.

## Version Contract

Every content page begins with:

- English page version, such as `EN 1.1.0`;
- product baseline, such as `v0.1.3`;
- last editorial update date;
- link to the paired language page;
- translation status and the English version translated.

Chinese pages additionally declare `zh-CN x.y.z` and `translated from EN x.y.z`.

Use semantic intent:

- patch: wording, links, formatting, or translation corrections without changing rules;
- minor: new documented behavior, tables, examples, or module contracts;
- major: incompatible terminology or a reorganized authority model.

The Wiki version is documentation metadata, not the game package version. Product baseline
records which released behavior the page describes.

## Translation Status

| English page                   | EN version | Chinese page                         | zh-CN version | Source translated | Status |
| ------------------------------ | ---------: | ------------------------------------ | ------------: | ----------------: | ------ |
| Home                           |      1.0.0 | Home-zh-CN                           |         1.0.0 |             1.0.0 | synced |
| World and Terrain              |      1.1.0 | World-and-Terrain-zh-CN              |         1.1.0 |             1.1.0 | synced |
| Background World               |      1.0.0 | Background-World-zh-CN               |         1.0.0 |             1.0.0 | synced |
| Character System               |      1.0.0 | Character-System-zh-CN               |         1.0.0 |             1.0.0 | synced |
| Abilities and Roles            |      1.0.0 | Abilities-and-Roles-zh-CN            |         1.0.0 |             1.0.0 | synced |
| Weapons, Armor, and Items      |      1.0.0 | Weapons-Armor-and-Items-zh-CN        |         1.0.0 |             1.0.0 | synced |
| Character and Map Interactions |      1.1.0 | Character-and-Map-Interactions-zh-CN |         1.1.0 |             1.1.0 | synced |
| Repository Architecture        |      1.0.0 | Repository-Architecture-zh-CN        |         1.0.0 |             1.0.0 | synced |
| Content and Modding            |      1.1.0 | Content-and-Modding-zh-CN            |         1.1.0 |             1.1.0 | synced |
| Sources and Design Boundaries  |      1.0.0 | Sources-and-Design-Boundaries-zh-CN  |         1.0.0 |             1.0.0 | synced |

## Publication Workflow

1. Edit the English source in `docs/wiki/` and bump its EN version.
2. Update the matching repository module docs and `CHANGELOG.md` when behavior changed.
3. Translate or revise the `-zh-CN` page. If deferred, keep its old version and mark
   `outdated: translated from EN x.y.z; current English EN a.b.c`.
4. Update both translation matrices.
5. Run `yarn validate:wiki` to check pairs, headers, internal links, and status metadata.
6. Commit the canonical repository source.
7. Synchronize `docs/wiki/*.md` into the separate `alohayo-world.wiki.git` repository,
   review its diff, commit, and push `master`.

Do not edit only the live Wiki. That creates an unreviewed fork from the AI-readable
repository source.
