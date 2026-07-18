# GitHub Wiki Maintenance

`docs/wiki/` is the canonical, reviewable source for the public GitHub Wiki. The live
Wiki is a separate Git repository at:

```text
https://github.com/GarfieldZHU/alohayo-world.wiki.git
```

## Language and Version Policy

- English is the editorial base.
- Every English content page has a paired `-zh-CN.md` page.
- Both pages declare their own Wiki version and product baseline.
- Chinese pages declare the exact EN version translated.
- If translation is deferred, do not pretend it is current: retain the old translated
  version and mark it outdated in both `Wiki-Versioning` matrices.

Wiki semantic versions describe documentation, not runtime packages. A page may remain
`EN 1.0.0` across several product releases if its documented contract did not change.

## Edit and Publish

1. Edit `docs/wiki/`, starting with the English page.
2. Update its version header and paired Chinese page/status.
3. Run:

   ```bash
   yarn validate:wiki
   yarn prettier --check docs/wiki docs/WIKI.md
   ```

4. Commit and push the canonical repository change; wait for CI.
5. Clone/update the Wiki beside the repository:

   ```bash
   git clone https://github.com/GarfieldZHU/alohayo-world.wiki.git ../alohayo-world.wiki
   git -C ../alohayo-world.wiki pull --ff-only
   rsync -av --delete --include='*.md' --exclude='*' docs/wiki/ ../alohayo-world.wiki/
   git -C ../alohayo-world.wiki diff --check
   git -C ../alohayo-world.wiki diff
   ```

6. Commit and push the Wiki repository's `master` branch.
7. Open the public Home, one English page, its Chinese pair, and the sidebar to verify
   navigation and version labels.

Never publish the Wiki before its canonical repository source passes validation. Never
use `--delete` against any destination other than the confirmed Wiki checkout.

## Scope

The Wiki explains product concepts, setting, module boundaries, and extension workflows.
Executable detail remains in schemas, JSON, code, ADRs, module docs, and `AGENTS.md`.
Link to authority instead of copying large contracts that will drift.
