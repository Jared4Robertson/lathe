# Brief: hard cutovers (remove every compatibility layer)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner's rule: "no legacy code compatibility stuff. Always do hard cutovers." When something is renamed or reshaped, every call site, record and test moves to the new form in one change, and the old form is deleted. That means no redirects, aliases, dual signatures, upgrades of saved state, or names kept to avoid churn. Remove the compatibility code that exists today, and add a rule that keeps it out.

## Remove
1. **Old addresses:**
   - `legacyAddress`, `redirectTarget`, `currentAddress` and `LEGACY_*` in `app/src/views/address.ts`;
   - the `redirect` route in `app/src/specs/data.ts`;
   - the redirect handling in `app/src/App.tsx`.
   
   An old `/records/…`, `/specs/…` or `/graph/…` address now shows "no such page", like any unknown address.
2. **`?view=split`:** only the view names are read.
3. **Saved state upgrades:** the conversion of saved tabs (`useTabs.ts`, `tabs.ts`) and of a space's remembered page (`shell/spaces.tsx`). A saved entry that isn't a valid address today is dropped.
4. **`addressOf(index, id)`:** remove the overload, so `addressOf(id)` is the only form, and update every call site.
5. **`FIELDS_COLUMN_ALIASES`** ("Business meaning") in `lathe/src/parse.ts`: a Fields table has one column name, Meaning. Update fixtures and FORMAT.md.
6. **"Inspector" kept as a name to avoid churn:** the panel is the side bar now. Rename it in labels, command IDs (`toggleInspector` becomes `toggleSideBar`), keymap entries, DOM ids and classes (`#inspector`, `.inspector-*`), the desktop menu, CSS, tests, the stability, perf and a11y suites, the format pages, and the specs (component names, the "06-focus-page-and-inspector" layer folder and its title). Settings stored under the old keys are dropped, not migrated.
7. **Anything else of the same kind:** search `app/src`, `lathe/src`, `lathe/checks`, `lathe/meta` and `desktop/src` for redirects, aliases, deprecated paths, "old", "legacy", "today's form", and second signatures. List what you removed.

## Specs
- Delete DR281 (Old addresses keep working), T521 and T522, and C271 (Saved pages in today's form). Edit UC50, UC112, C50 and C270, and any other record that promises redirects or conversions.
- Add an App code pattern rule, `LA-PAT-APP-CODE-R20` "Changes are hard cutovers". It says no redirects, aliases, dual signatures, upgrades of saved state, or old names kept. Prove it with a source test in `app/test/standards.test.tsx` that fails on `legacy`, `redirect`, `alias`, or a second `addressOf` signature in `app/src` and `lathe/src`, naming the file and line.

## Scope
Another agent (brief 72, the icicle layout) owns `app/src/graph/**`. If a rename reaches into graph files, make the smallest change there; that agent merges after you and resolves any conflicts. Use test IDs from T660 upward.

## Checks
Run the full checks from the common rules, plus the stability suite (one worker). Run the accessibility suite (`npm --prefix app run test:a11y`), since labels change. Never use port 5199.

## Report
- the branch and its last commit;
- everything removed;
- the renames;
- the checks you ran and their results;
- anything left open.
