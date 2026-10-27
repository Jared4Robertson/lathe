# Brief: import every product into `data/` (database first, step 3)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and the schema brief's report in [notes/db-first-interfaces.md](../db-first-interfaces.md) first. **Base branch: `db-first`.** Work in your own worktree from it, and finish with your branch ready to merge into `db-first`.

## Goal
Convert every product's Markdown spec into the typed tables, using the command layer, and write the `data/*.jsonl` files. That covers Lathe (`specs/lathe`), the Tool Library and every Markdown fixture the tests use. After this, the data files hold everything the Markdown held.

## Decisions
1. **A one-time converter,** `lathe/scripts/import-markdown.ts`, uses the current Markdown parser (`lathe/src/parse.ts`) to read and the command layer to write. It's deleted in the engine brief's cutover, so keep it self-contained.
2. **Bodies into typed fields.** For each kind, map the body's sections and text into that kind's typed fields:
   - a requirement's body becomes its `statement`;
   - a test's Given/When/Then become `given`, `when` and `then`;
   - an entity's Fields table becomes `entity_field` rows.
   
   Text that fits no field goes into the kind's `notes` field if it declares one. Otherwise:
   - shorten it into the right field where the meaning is kept;
   - or, where it carries real content, add a `notes` field to that kind in the schema with a new migration;
   - list every such case in the report.
   
   Never silently drop content.
3. **Prose citations** of IDs inside text stay as plain text.
4. **Fixtures:**
   - test fixtures in `lathe/test/fixtures/` and `app/test/fixtures/` become `data/` folders beside them;
   - fixtures that exist to test Markdown parsing (bad YAML, bad headers) have no meaning in the new model and are removed with their tests in the engine brief; list them;
   - fixtures that test a check become data that breaks that check's rule. Where the schema now refuses that data outright, list the fixture for the engine brief, which turns it into a constraint test.
5. **Check SQL files** (`lathe/checks/*.sql` and products' own checks) become `check` rows. Keep each query's text as is for now; the engine brief rewrites the queries.
6. **Round-trip proof:** the converter verifies that each product's record count, IDs, parents and links match between the Markdown load and the data load, and the report shows the counts.

## Owns
`lathe/scripts/import-markdown.ts`, every `data/` folder, and new schema migrations for notes fields only. Don't touch the engine, app or plugin code.

## Checks
- The converter's round-trip comparison passes for every product.
- Loading every `data/` folder succeeds with all constraints.
- Typecheck and knip pass.
- Gate on real exit codes. Never use port 5199.

## Report
The branch and its last commit, counts per product and kind, every body that needed a decision (kind, ID, what you did), the fixtures listed for the engine brief, and the checks run with their results.
