# Brief: the engine on the typed tables (database first, step 4)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `db-first`.** Work in your own worktree from it, and finish with your branch ready to merge into `db-first`.

## Goal
`lathe check` and coverage run on the typed tables loaded from `data/`, and the Markdown path is gone. This is a hard cutover.

## Decisions
0. **Start:** your worktree starts from main. First run `git reset --hard db-first` (there's nothing to lose), then read `notes/store-interfaces.md`. When the import brief lands in `db-first`, merge `db-first` to get Lathe's real data.
1. **Loading:** the engine's entry (`lathe/src/index.ts`) loads the workspace from `data/` through the store. The Markdown reader (`parse.ts`), the meta CSVs, `lathe format`, prose parsing (`prose_mentions`, `entity_tables`, `entity_fields`) and the generic `records`, `fields` and `links` tables all go.
2. **Checks:**
   - Every check in `lathe/checks/` is rewritten against the typed tables.
   - A check whose rule the schema now enforces (dangling link, wrong parent kind, bad ID format, missing required field, bad enum, a link across products, bad dates and the like) is retired; its fixture becomes a constraint test showing the store refuses that data.
   - The rest (warnings, coverage gaps, lone children, too many children, unused standards and the like) stay as queries.
   - Checks are rows in the `check` table. The import brief (99) writes Lathe's built-in checks to `lathe/data/check.jsonl`, a data folder inside the package. Make the store load that package folder beside each product's `data/`. The store loads one folder today. Choose whether a check's query lives in the row or in a file it names, keep that one way, and document it.
3. **Coverage** (`coverage.ts`) becomes views over the typed tables and the `obligation` supertype, with the same counts. `owed_pattern_rules` is kept, rewritten.
4. **Code scanning** (`file_facts`, `file_mentions`) stays, reading `file` columns from the typed tables.
5. **Docs:**
   - FORMAT.md is deleted. REFERENCE.md is generated from the schema description and the `check` rows: each table and its columns, each relation, each check.
   - `lathe/README` and the root README describe the data model, `data/`, the merge driver setup, and how to change data (CLI or app).
6. **Tests:**
   - You own converting the engine's fixtures (`lathe/test/fixtures/`) into `data/` folders, written with the store. Tests of Markdown parsing are removed.
   - A fixture that tests a check whose rule the schema now refuses becomes a constraint test.
   - Delete the `lathe/test/store/schema.test.ts` cases that compare the schema with `lathe/meta/*.csv`, along with the CSVs.
   - Every retired check gains a constraint test.
   - Coverage tests keep their numbers.
   - Perf: `npm --prefix lathe run test:perf` keeps its budgets.

## Owns
`lathe/src` (except `store/`, which you call and may extend with the store's owner's interfaces), `lathe/checks`, `lathe/test`, `lathe/meta` (deleted), FORMAT.md, REFERENCE.md and the READMEs. Don't touch `app/` or the plugin; the app and writer briefs run beside you. In `lathe/bin/lathe.ts`, remove the `format` command; the writers brief adds its commands there too, so keep your edits to that file small.

## Checks
The full lathe checks (typecheck, tests, knip, perf), gated on real exit codes. Never use port 5199.

## Report
The branch and its last commit, each check (kept, rewritten or retired into a constraint), coverage numbers before and after for LA, what was deleted, and the checks run with their results. Leave nothing open.
