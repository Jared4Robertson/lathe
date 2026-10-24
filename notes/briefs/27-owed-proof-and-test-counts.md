# Brief: owed proof and tests by state, in the engine and the app

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-6`.

## Goal
Re-trial recommendation 10 and finding G: a planned proof is hidden when another test already proves the same obligation, and nothing counts a domain's tests by state, as S2's test-coverage table does.

## The contract (committed; do not change it)
`lathe/src/types.ts`: `ObligationCoverage.planned_any` (obligations with a planned test meant to prove them, proved or not) and `Coverage.tests` (`TestCounts`: automated, manual, planned; a test with no state is automated).

## What to do
1. Engine, `lathe/src/coverage.ts` only: fill `planned_any` per obligation kind and `tests` per domain. Count a domain's tests by the test records whose domain it is.
2. CLI (`lathe/bin/lathe.ts`, the coverage lines only): show planned_any where it differs from planned, and one line per domain with its tests by state.
3. App: show tests by state with each domain's coverage (product and domain pages, the evidence panel), and planned_any next to the planned bar ("2 more planned"); treat missing fields as unknown, not zero.
4. Tests for both (engine: a new `lathe/test/owed-proof.test.ts` with fixtures `lathe/test/fixtures/owed-*`; app: vitest + testing-library).
5. Lathe's own spec: use case `LA-CHK-UC16` under `LA-CHK-CAP02` (engine) and `LA-BRW-UC70` under `LA-BRW-CAP01` (app), with requirements, domain rules `LA-CHK-DR100`–`DR109` and `LA-BRW-DR80`–`DR89`, components `LA-CHK-C100`–`C109` and `LA-BRW-C80`–`C89`, tests `LA-CHK-T170`–`T189` and `LA-BRW-T180`–`T199`, and a flow carrying out each use case. All satisfied and proved; every new rule applied.

## Scope
You own: `lathe/src/coverage.ts`, the coverage lines in `lathe/bin/lathe.ts`, `app/src/specs/ProductHealth.tsx` and any new file under `app/src/specs/` for this, `app/test/` files you add, the test files and fixtures above, and the spec records above. Others change `runChecks`/config, the meta-model, check files, and other app files (`app/src/specs/RecordContent.tsx`, `app/src/graph/**`) in parallel; keep `app/src/styles.css` edits to one appended, marked section.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
