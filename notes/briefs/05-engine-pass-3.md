# Brief: engine, pass 3 (built coverage, meta-model checks, fitness, Checking tests)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Apply three decisions Jared made, and prove the Checking domain's requirements with tests, so Lathe's own coverage for `LA-CHK` matches the Tool Library's.

## Decisions already made (by Jared)
- **LA-CHK-Q02 Planned components:** report built and designed separately. Coverage gains `requirements_built` and `rules_built` (see `lathe/src/types.ts`): satisfied by a component whose `file` exists. The CLI's coverage line shows designed, built and proved.
- **LA-CHK-Q03 Meta-model checks:** yes. Add checks that the meta-model is consistent: every kind in `parent_kinds` and every `source_kind`/`target_kind` (other than `*`) is a defined kind, no duplicate kinds, no duplicate relation rows, and each record kind's required fields are valid names. Report them as errors with record null.
- **LA-CHK-Q01 Edit the meta-model in the app:** no. The meta-model changes by editing its files and reviewing the diff, like records.
- **LA-Q01 Fitness:** both signals and judgment. The `fitness` kind is in `lathe/meta/kinds.csv` (see FORMAT.md section 7). Add an error check that a fitness record's `date` is a real YYYY-MM-DD date and its `score` is a whole number from 1 to 5.

## Scope
- Read first: `lathe/FORMAT.md` (sections 6 to 8), `lathe/src/*`, `lathe/checks/*`, `lathe/test/*`, `lathe/bin/lathe.ts`, `lathe/src/server/*`, and everything under `specs/lathe/checking/`.
- You own: `lathe/**` except `lathe/meta/*`, `lathe/src/types.ts`, `lathe/FORMAT.md`, `lathe/test/diagrams.test.ts` and `lathe/test/fixtures/diagrams/**` (another agent writes those). You also own `specs/lathe/checking/**`.

## What to do
1. Implement the four decisions above, with tests.
2. In `specs/lathe/checking/`: remove `Q01`, `Q02` and `Q03` and write their answers into the records they affect (a requirement or rule each, satisfied by the component that implements it). Add a component record for any new check files.
3. Prove every `LA-CHK` requirement and domain rule with a test: add test records (`LA-CHK-T09` onwards) and the tests they name, in `lathe/test/`. This includes `lathe init` (`LA-CHK-UC06-R01`) and `lathe serve` (`LA-CHK-UC06-R04`): test serve by starting it on port 5340 (and 5341, 5342 if you need several) inside the test, requesting a page, `/api/spec` and `/api/events`, then closing it. Serve needs the built app: have the test build it into a temporary folder or skip with a clear message when `dist/app` is missing, and say which you chose.
4. Keep `npm --prefix lathe run check` at 0 errors, with `LA-CHK` at full coverage: every requirement and rule satisfied and proved.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check`.
