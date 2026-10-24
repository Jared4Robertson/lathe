# Brief: coverage driven by the meta-model, and interaction requirements

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Lathe's coverage today counts only the fixed kinds `requirement` and `domain_rule`, and only `satisfies`/`proves` links. The S2 trial showed that a third of a mature product's requirements live at views and endpoints, and that a product's own obligation kinds are never counted. Make coverage follow the meta-model, so every obligation kind (including the new `interaction_requirement`) is counted the same way.

## The contract (already committed; do not change it)
`lathe/meta/kinds.csv` has an `obligation` column; `lathe/meta/relations.csv` has a `role` column (`design`, `proof`, or empty); `interaction_requirement` is a new kind; `lathe/src/types.ts` adds `Kind.obligation`, `RelationRule.role`, `ObligationCoverage` and `Coverage.obligations`; `lathe/FORMAT.md` section 6 says how coverage is counted, and section 4 defines test states (`automated`, `manual`, `planned`).

## What to do
1. Load the new columns (`obligation` as a boolean, `role` as text) into the `kinds` and `relations` tables and into the returned `Workspace`.
2. Rewrite coverage (`lathe/src/coverage.ts`) and the `unsatisfied` and `unproved` checks so they count every obligation kind and every `design`/`proof` relation from the meta-model, never fixed names. Fill `Coverage.obligations` per domain in meta-model order; keep the `requirements_*` and `rules_*` fields filled from it. "Proved" counts only automated and manual tests (a test with no `state` is automated); "planned" counts obligations not proved but targeted by a planned test. Gaps use the obligation's kind.
3. CLI: one coverage line per domain and obligation kind with designed, built, proved and planned counts.
4. Tests, including: an extension adding an obligation kind and a design relation is counted; an interaction requirement is counted; planned tests count as planned, not proved.
5. Lathe's own spec: add records for this in `specs/lathe/checking/` using only use case `LA-CHK-UC07` (with its requirements), domain rules `LA-CHK-DR20`–`DR29`, components `LA-CHK-C20`–`C29` and tests `LA-CHK-T40`–`T49`. You may also edit `LA-CHK-UC02` and its requirements (coverage) to match. All new obligations satisfied and proved.

## Scope
You own: `lathe/src/coverage.ts`, `lathe/src/index.ts` (meta loading and coverage wiring only; another agent changes the file-fact and meta-merge parts of this file, so keep your edits in those functions), `lathe/bin/lathe.ts`, `lathe/checks/15-unsatisfied.sql`, `lathe/checks/16-unproved.sql`, new test files `lathe/test/coverage.test.ts` and fixtures under `lathe/test/fixtures/coverage-*`, and the spec records above. Not: `lathe/meta/*`, `lathe/src/types.ts`, `lathe/FORMAT.md`.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
