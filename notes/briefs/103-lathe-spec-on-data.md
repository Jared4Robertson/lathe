# Brief: Lathe's own spec describes the data model (database first, step 7)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and [notes/db-first-interfaces.md](../db-first-interfaces.md) first. **Base branch: `db-first`.** Your worktree starts from main, so first run `git reset --hard db-first`. Finish with your branch ready to merge into `db-first`.

## Goal
Briefs 98–102 rebuilt Lathe on typed tables stored as JSONL, with the CLI, MCP tools and an editing app. Lathe's own spec (in `data/`) still describes the old Markdown model. Update it so it describes Lathe as it now is, writing only through the CLI (`lathe add`, `set`, `move`, `link`, `remove`), never by editing JSONL by hand.

## What to change (from the plan's "Changes to existing specs")
- **Authoring:**
  - The record format becomes the schema: A1 Meta-model and the format use cases and rules describe tables, typed fields, keys, link tables, supertypes, the ID registry and product kinds.
  - Domain rules that described YAML headers, Markdown bodies, file layout, prose citations or `lathe format` are removed or rewritten.
  - The Product extension aggregate becomes the product-kind declaration.
  - Add a use case and requirements for changing data through the command layer, and for the merge driver.
- **Checking:**
  - Check records describe `check` rows, not SQL files with headers.
  - Rules the schema now refuses are recorded as constraints. Remove checks that were retired.
  - The Check aggregate gains `problem`.
- **Traceability:** coverage and gaps are views over the tables; prose mentions are gone.
- **Exploring:** add the editing use case and requirements (forms from the schema, add a child, remove with references named, inline refusals). History reads git. Pages show typed fields.
- **Platform:**
  - the workspace loads `data/`;
  - the app server has a write API;
  - live reload watches `data/`;
  - the command layer is an aggregate;
  - the merge driver is set up per repo.
- **Components and tests:** every component's `file` and every test's `file` must name a file that exists after the cutover. Add components for the new code (store, schema, migrations, merge driver, CLI commands, MCP server, app forms and write API), each satisfying what it builds, and tests for what the briefs tested, each proving its obligations.
- **From the writers brief:** `data/flow.jsonl` LA-CHK-F01 still describes the old after-edit hook; rewrite it for the guard hook and the checked writes. The CLI's tests are in `lathe/test/cli/` and the plugin scripts are in `plugin/scripts/`.
- **Leftovers:** remove every record that describes something deleted, with nothing outliving its purpose.

## Checks
- `lathe check` on LA: 0 errors, and no new warnings beyond the 5 known `event-unheard` ones; fix any you can.
- Coverage: designed, built and proved don't drop against `db-first` before your change; report both.
- Sweep: no record mentions Markdown files, YAML headers, `specs/`, FORMAT.md or `lathe format`, except a record that says they were removed.
- Typecheck and unit tests in lathe, gated on real exit codes. Never use port 5199.

## Report
The branch and its last commit, the records added, changed and removed (counts and IDs by slice), coverage before and after, the check result, and the checks run with their results. Leave nothing open.
