# Brief: every proof claim is checkable, and an optional key

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-5`.

## Goal
From the S2 re-trial (notes/trials/s2-accounting.md, section 6, findings C and D): today, if an automated test's file names one of the IDs the test proves, every other claimed proof goes unchecked; and a test file that names no ID at all (S2's pattern proofs) cannot be accepted.

## Decisions
- An automated test's `run_by` file must name **the test's own ID**, or else **every** ID the test proves (`proof`-role targets). When it names neither the test's ID nor all proved IDs, report each proved ID it leaves out (error `proof-not-in-file`, one per missing ID), replacing today's single `test-file-missing-id` for that case. When it names the test's own ID, all its claims are accepted (the test record vouches for them).
- An optional `key` field on a test: text the file must contain instead (for example a test function name). When `key` is present, the file must contain the key, and then the ID rules above do not apply.
- IDs are matched as whole IDs, as now.

## What to do
1. Implement in `lathe/src/index.ts` (the `gatherFileFacts` function and the tables it fills only) and the test checks `14-test-file-missing-id.sql` (and a new `proof-not-in-file` file numbered 40).
2. `lathe/FORMAT.md` section 4: describe both rules and `key`.
3. Tests in a new `lathe/test/proof-claims.test.ts` with fixtures `lathe/test/fixtures/claims-*`.
4. Lathe's own spec: use case `LA-CHK-UC12` under `LA-CHK-CAP01`, with requirements, domain rules `LA-CHK-DR60`–`DR69`, components `LA-CHK-C60`–`C69`, tests `LA-CHK-T110`–`T119`. Update `LA-CHK-UC08-R01` and `LA-MOD-DR12` to match. All satisfied and proved. Fix any test in the repo that the stricter rule now flags (Lathe's, the Tool Library's) by naming the missing IDs in the test names.
5. Plugin: update `plugin/skills/plan-tests/SKILL.md` and `check-and-fix` for the new rule and `key`.

## Scope
You own: `gatherFileFacts` in `lathe/src/index.ts`, `lathe/checks/14-*` and new file 40, `lathe/FORMAT.md` section 4, the test file and fixtures above, the spec records above, `plugin/skills/plan-tests` and `plugin/skills/check-and-fix`, and test names in `lathe/test/**`, `app/test/**` and `examples/tool-library/test/**` only where the new rule flags them. Others are changing other parts of `lathe/src/index.ts`, other checks, `lathe/src/coverage.ts` and `app/src/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
