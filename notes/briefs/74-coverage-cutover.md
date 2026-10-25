# Brief: coverage reports in one shape (hard cutover)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The engine's coverage report still carries per-kind fields "kept for older readers", and the app still reads reports from an older engine. Under the hard-cutover rule there is one shape: `obligations` (one entry per obligation kind, each with `planned_any`) and `tests`.

## Remove
1. From `Coverage` in `lathe/src/types.ts`: `requirements`, `requirements_satisfied`, `requirements_built`, `requirements_proved`, `rules`, `rules_satisfied`, `rules_built` and `rules_proved`. Stop filling them in `lathe/src/index.ts`. `built`, `planned` and `planned_any` on each obligation are always numbers.
2. In the app:
   - `obligationGroups` reads `obligations` only, with no fallback;
   - `countsByKind` and any `Partial<Coverage>` reads go;
   - `measured()` no longer covers missing fields, unless they're still legitimately optional in the engine's types;
   - every "nothing planned shown" path that exists only for old reports goes.
3. Fixtures: `lathe/fixtures/workspace.sample.json` (regenerate it if a script makes it), `app/test/fixtures/*`, `app/test/graph/workspace.ts` and `app/test/long-list.test.tsx`; and the engine tests `coverage`, `engine` and `checks`.
4. Specs: DR80, T181, T183 and T275 describe the fallback. Delete what only promises the fallback and edit the rest. FORMAT.md, `lathe/REFERENCE.md` (regenerated) and the plugin docs must not mention the old fields.

## Scope
Brief 72 (graph icicle) may still be merging; it owns `app/src/graph/**`. Your edit to `app/test/graph/workspace.ts` is small, so merge main before reporting and keep both sides. Use test IDs from T670 upward.

## Checks
The full checks from the common rules. No UI changes are expected, so the stability suite isn't needed unless you change something on screen. Never use port 5199.

## Report
The branch and its last commit, what you removed, the checks you ran and their results, and anything left open.
