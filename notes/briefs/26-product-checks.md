# Brief: a product's own checks

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-6`.

## Goal
S2 has house rules Lathe should not ship as defaults (for example "each aggregate has exactly one Record view use case", level matching, access-row citations). Let a product add its own checks, in the same form as Lathe's, so such rules live with the product (re-trial recommendation 9; answers `LA-CHK-Q11`).

## Decisions
- `lathe.config.json` gains an optional `checks` folder (relative to the root). Every `*.sql` file in it runs after Lathe's checks, against the same tables, with the same row contract `(severity, check, record, message)`; its check name comes from its file name, as for Lathe's; a product check whose name equals a Lathe check is an error (`product-check-name-clash`), so the two never mix in reports.
- A product check that fails to run is an error naming the file, as Lathe's are.
- `Problem` gains nothing: product checks are ordinary problems. Document in FORMAT a new section 13 "A product's own checks" and in the package README.
- Make the `unproved` check (`lathe/checks/16-unproved.sql`) count only proofs a test's file backs, as coverage now does (coverage.ts's `backed` rule: an automated test's file names its own ID, its key, or that target), so warnings and coverage agree.

## What to do
1. Implement in `lathe/src/config.ts` (the `checks` key) and `lathe/src/index.ts` (`runChecks` and its caller only).
2. Tests in `lathe/test/product-checks.test.ts` with fixtures `lathe/test/fixtures/product-checks-*`, including a check that encodes S2's "one Record view use case per aggregate" against a small fixture, to show the mechanism carries that rule.
3. This repo has one `lathe.config.json` for all its products, so give it a `checks` folder at `lathe-checks/` (repo root) with one check that is genuinely useful here, such as "every endpoint has at least one interaction requirement". Fix anything it finds.
4. Lathe's own spec: answer and remove `LA-CHK-Q11`; add use case `LA-CHK-UC15` under `LA-CHK-CAP04` with requirements, domain rules `LA-CHK-DR90`–`DR99`, components `LA-CHK-C90`–`C99`, tests `LA-CHK-T150`–`T169`, and a flow that carries it out (Lathe warns about a use case with no flow). All satisfied and proved; every new domain rule applied by a use case.
5. Plugin: a short section on product checks in `plugin/skills/extend-the-meta-model/SKILL.md`.

## Scope
You own: `lathe/src/config.ts`, `runChecks` and its call in `lathe/src/index.ts`, `lathe/checks/16-unproved.sql`, `lathe.config.json`, `lathe-checks/**` (new), `lathe/FORMAT.md` section 13 (new, at the end), `lathe/README.md`, the test file and fixtures above, spec records above, fixes the new check finds in `specs/**`, and that plugin skill. Others change `lathe/src/coverage.ts`, the meta-model, and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
