# Brief: modelling, pass 3 (Modelling decisions and tests)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Settle the Modelling domain's open questions as decided, and prove its requirements and rules with tests, so Lathe's coverage for `LA-MOD` is full.

## Decisions already made (by Jared)
- **LA-MOD-Q01 Diagrams and records:** keep them separate. CSV diagrams are brainstorm canvases for thinking before anything is specified; once a domain is specified, its picture is drawn from its records (the spec browser's Graph tab), not from a hand-made diagram. No merging of the two formats.
- **LA-MOD-Q02 Record status:** no status field. A record in the specs is in force, uncertainty is an open question, and git keeps the history (FORMAT.md section 8 now says so).

## Scope
- Read first: `lathe/src/server/diagrams.ts`, `lathe/src/server/api.ts`, `lathe/diagrams/checks.sql`, `model/` (the diagram data and README), `lathe/FORMAT.md`, and everything under `specs/lathe/modelling/`.
- You own: `lathe/test/diagrams.test.ts`, `lathe/test/fixtures/diagrams/**`, and `specs/lathe/modelling/**`. Another agent owns the rest of `lathe/`; if a test you write shows a bug in `diagrams.ts` or `checks.sql`, do not fix it: mark the test with `it.todo` or `it.fails`, explain it in your report, and name the record it affects.

## What to do
1. Write vitest tests in `lathe/test/diagrams.test.ts` for the diagram functions (`listDiagrams`, `loadDiagram`, `createDiagram`, `slugify`) and for `lathe/diagrams/checks.sql`, using fixture diagram folders you create under `lathe/test/fixtures/diagrams/`. Cover each diagram rule (for example: a part in two aggregates, an includes link that would make a topic have two parents, unknown kinds) and the API's create and refuse behaviour through `handleApi` with a fake request and response if useful.
2. In `specs/lathe/modelling/`: remove `Q01` and `Q02` and write their answers into the records they affect. Add test records (`LA-MOD-T01` onwards) with `run_by: lathe/test/diagrams.test.ts`, so every `LA-MOD` requirement and rule is proved. Check that component `file` fields are current.

## Checks
`npm --prefix lathe run typecheck`, `npx --prefix lathe vitest run lathe/test/diagrams.test.ts` (or `cd lathe && npx vitest run test/diagrams.test.ts`), `npm --prefix lathe run check` (its `LA-MOD` line should show full coverage).
