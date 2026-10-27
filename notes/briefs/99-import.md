# Brief: import every product into `data/` (database first, step 3)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and the schema brief's report in [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `db-first`.** Work in your own worktree from it, and finish with your branch ready to merge into `db-first`.

## Goal
Convert every product's Markdown spec into the typed tables, using the command layer, and write the `data/*.jsonl` files. That covers Lathe (`specs/lathe`), the Tool Library and Lathe's built-in checks. After this, the data files hold everything the Markdown held. Test fixtures aren't yours: the engine brief (100) moves the lathe fixtures and the app brief (102) the app fixtures.

## Decisions
0. **Start:** your worktree starts from main. First run `git reset --hard db-first` (there's nothing to lose), then read `notes/store-interfaces.md`.
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
4. **Checks:**
   - Lathe's built-in checks (`lathe/checks/*.sql`) become `check` rows in `lathe/data/check.jsonl`, a data folder shipped inside the package.
   - A product's own checks become `check` rows in that product's `data/`.
   - Keep each query's text as is; the engine brief rewrites the queries and loads the package folder beside the product's.
5. **Round-trip proof:** the converter verifies that each product's record count, IDs, parents and links match between the Markdown load and the data load, and the report shows the counts.

## Owns
`lathe/scripts/import-markdown.ts`, the products' `data/` folders (Lathe's at the repo root, the Tool Library's in its own folder), `lathe/data/`, and new schema migrations for notes fields only. Don't touch the engine, app or plugin code.

## Checks
- The converter's round-trip comparison passes for every product.
- Loading every `data/` folder succeeds with all constraints.
- Typecheck and knip pass.
- Gate on real exit codes. Never use port 5199.

## Report
The branch and its last commit, counts per product and kind, every body that needed a decision (kind, ID, what you did), where each product's data folder is, and the checks run with their results.
