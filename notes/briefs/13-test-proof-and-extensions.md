# Brief: tests prove what their file names, test states, and extensions that widen kinds

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Two false-error sources from the S2 trial. First, S2 keys each rule test by the rule's ID, and plans tests before they exist; Lathe demands a separate test ID in code and an existing file. Second, a product cannot adapt Lathe's default kinds without forking: a second row for a default kind is silently ignored.

## The contract (already committed; do not change it)
`lathe/FORMAT.md` sections 4 (test states and what `run_by` must mention), 5 and 9 (extensions widen kinds); `test` no longer requires `run_by` in `kinds.csv`.

## What to do
1. **Test proof by named ID:** an automated test's `run_by` file must mention the test's ID or the ID of any record it `proves` (or any `proof`-role relation's target). Update `14-test-file-missing-id`.
2. **Test states:** `state` is `automated` (default when absent), `manual` or `planned`; any other value is an error `bad-test-state`. An automated test with no `run_by` is an error `test-run-by-missing`; manual and planned tests need none, and their `run_by`, if given, is checked only for existing. Update `13-test-file-missing` accordingly.
3. **Extensions widen kinds:** in meta loading, merge rows with the same `kind` across the default and extension folders: union `parent_kinds` and `required_fields`, and let a non-empty `label`, `stage`, `obligation` or `description` from the extension replace the default's. Relations: drop exact duplicates across folders. Two rows for the same kind within one folder stay an error (`meta-duplicate-kind`, now per folder). Report which folder each meta row came from if that helps the messages.
4. Tests for each of these, with fixtures, including a rule test keyed by the rule's ID, a planned test, a manual test, and an extension that lets `domain_rule` sit under `domain`.
5. Lathe's own spec in `specs/lathe/checking/`: use only use cases `LA-CHK-UC08` (tests) and `LA-CHK-UC09` (extensions) with their requirements, domain rules `LA-CHK-DR30`–`DR39`, components `LA-CHK-C30`–`C39`, tests `LA-CHK-T50`–`T69`. You may edit `LA-CHK-UC05`, `LA-CHK-UC06` and their requirements, and `LA-CHK-T04`, to match. All new obligations satisfied and proved.

## Scope
You own: `lathe/src/index.ts` (file facts and meta loading/merging only; another agent changes the coverage wiring in this file, so keep your edits in those functions), `lathe/src/parse.ts` if needed, `lathe/checks/13-*`, `14-*`, `19-*` and new check files numbered 26 onwards, new test files `lathe/test/tests-and-meta.test.ts` with fixtures under `lathe/test/fixtures/proof-*` and `lathe/test/fixtures/widen-*`, and the spec records above. Not: `lathe/meta/*`, `lathe/src/types.ts`, `lathe/FORMAT.md`, `lathe/src/coverage.ts`.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
