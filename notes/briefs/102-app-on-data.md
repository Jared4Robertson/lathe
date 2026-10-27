# Brief: the app reads and edits the typed data (database first, step 6)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and [notes/db-first-interfaces.md](../db-first-interfaces.md) first. **Base branch: `db-first`.** Work in your own worktree from it, and finish with your branch ready to merge into `db-first`.

## Goal
The app reads every product from the typed tables and lets the Owner edit records in place, with forms generated from the schema. History comes from git.

## Decisions
1. **Server** (`app/server/`, the Vite dev server plugin and the desktop's server):
   - loads the workspace through the store and serves the typed data in place of the Markdown-derived index;
   - adds a write API (add, set, move, link, unlink, remove) that calls the command layer and returns the changed rows or the refusal;
   - live reload watches `data/`.
2. **Reading:**
   - The app's spec index (`app/src/specs/data.ts` and its callers) is built from typed rows. Pages show each kind's typed fields in place of a Markdown body: the statement, Given/When/Then, the entity fields table and notes.
   - Notes fields may hold Markdown and are rendered as today.
   - Every view (wiki pages, graph, Model view, side bar, quick find, Checks) keeps working on the new index. Its look stays the same apart from bodies becoming fields.
3. **Editing:**
   - Every record page has an Edit action that opens a form generated from the schema description: typed inputs, enums as selects, parents and links as pickers limited to valid targets.
   - Add a child from the parent's page, and remove with a confirmation that names what still references the record.
   - Refusals show inline with the reason.
   - Keyboard and a11y as for the rest of the app (LA-PAT-APP-UX R10).
4. **History:** the side bar's History reads `git log` for the record's rows (the lines in its table's file) through the server: commit, author, date and the changed fields.
5. **Desktop:** the Electron shell opens a workspace with `data/` and uses the same server.

## Owns
`app/` and `desktop/`, and their tests. Don't touch `lathe/src/store/` (call it), `lathe/checks` or the plugin.

## Checks
- Unit tests for the index from typed rows and for form generation.
- Stability and a11y scenarios for edit, add, remove and a refusal.
- The full checks, plus the stability, a11y and perf suites, each run once with one worker, gated on real exit codes.
- Screenshots of a requirement page, a test page, an entity page and the edit form, light and dark, saved to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/dbapp/`, and look at them.
- Never use port 5199.

## Report
The branch and its last commit, what changed, the screenshots, and the checks run with their results. Leave nothing open.
