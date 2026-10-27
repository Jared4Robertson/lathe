# Brief: the schema and the store (database first, steps 1 and 2)

Read [00-common-rules.md](00-common-rules.md) and the plan [notes/plans/database-first.md](../plans/database-first.md) first. **Base branch: `db-first`**, the integration branch for this hard cutover, not `main`. Work in your own worktree from `db-first`, and finish with your branch ready to merge into `db-first`.

## Goal
Lathe is moving from Markdown files to structured, schema-enforced data: a table per kind, stored as one JSONL file per table in the repo, with git as the history. This brief builds the foundation every later step uses:
- the **schema** (step 1);
- the **store**: loading, the command layer and the merge driver (step 2).

Four agents start from your branch when it lands (import, engine, writers, app), so make the interfaces clear and documented.

## Decisions (Owner, from the plan; apply them)
- **A table per kind** with typed columns, real keys and checks. Containment is a foreign key: `domain.product_id`, `use_case.domain_id`, `requirement.use_case_id`, and so on.
- **Links:** a link table per relation (`satisfies`, `proves`, `follows`, `meets` and the rest), with real foreign keys. Relations that target several kinds point at a supertype table. `obligation` covers requirement, domain rule, pattern rule and interaction requirement; add others where a relation needs one.
- **An ID registry,** `record_id(id PK, kind)`, keeps every ID unique across tables, so a bare ID resolves to its kind. Every kind's `id` is a foreign key into it.
- **Typed text fields per kind,** with no free body. Long notes appear only where a kind declares a `notes` field.
  - For each kind, derive its fields from how its records are written today: the header fields in `lathe/meta/kinds.csv` (`required_fields`), the fields used across `specs/`, the body sections FORMAT.md describes, and FORMAT.md's per-kind sections.
  - Name fields plainly: a requirement's `statement`, a test's `given`, `when`, `then`, `state` (an enum of automated, manual, planned) and `file`; a use case's `actor` and `goal`; an entity's fields as `entity_field` rows (position, name, meaning, type, example).
  - A short title is a `title` column on every kind.
- **Domain rule:** `domain_id` is required and `aggregate_id` optional. A rule spanning aggregates names them with `involves`.
- **Product kinds:** a product declares extra kinds (`product_kind` and `product_kind_field` tables: name, parent kind, fields with types), and Lathe generates their tables with the same registry, keys and checks.
- **Checking tables:**
  - `check`: name, severity (enum), summary, explanation, query, and a product ID for a product's own checks;
  - `problem`: the result of a run;
  - typed settings, such as the structure size limit.
- **The schema is the meta-model.** It replaces `lathe/meta/*.csv`, but don't delete those yet: the engine brief does the cutover.

## Build
1. **Schema:**
   - Numbered SQL migrations in `lathe/schema/`, applied in order to a DuckDB database.
   - Use DuckDB, which is already the engine, with PRIMARY KEY, FOREIGN KEY, NOT NULL, CHECK and ENUM types. Where DuckDB can't enforce something (for example a constraint across tables), add a validation query the command layer runs in the write transaction, and list each one.
   - Also include a schema description that later steps can read: TypeScript types and a per-table, per-column description, generated from or kept beside the migrations, for the app's forms, the CLI and the reference docs.
2. **Load:**
   - `lathe/src/store/`: read `data/*.jsonl` (default folder `data/` at the workspace root, configurable in `lathe.config.json`) into the typed tables, in dependency order.
   - A row that breaks a key or check fails to load, with a clear error naming the file, the line and the rule.
3. **Command layer:**
   - One function per operation (add, set, move, link, unlink, remove), each run in one transaction: apply, run the validation queries, then rewrite only the affected files.
   - Files are deterministic: rows sorted by ID (link tables by their key columns), columns in a fixed order, one JSON object per line, UTF-8, with a trailing newline.
   - Removing a row that others reference is refused, with what references it.
4. **Merge driver:**
   - A `lathe merge-data` command and a `.gitattributes` line for `data/*.jsonl`. It keeps both sides' lines against the base, sorts them again and loads the result with the constraints.
   - A real clash (one ID added twice with different content, or one row changed on both sides) fails with a clear message.
   - Document the one-time `git config` it needs in the repo's README or setup script.

## Out of scope
- Converting the current specs (the import brief).
- Rewriting the checks and coverage.
- The CLI, MCP tools and app.
- Deleting the Markdown path.

The existing engine keeps working untouched beside the new code until the engine brief cuts over.

## Checks
- Unit tests for:
  - each kind's keys and checks (a good row loads; a bad parent, a duplicate ID, a bad enum value or a missing required field is refused);
  - deterministic file output (write, reload and write again gives identical bytes);
  - each command;
  - the merge driver (both sides added, a real clash, one ID added twice).
- Then the full checks (typecheck, unit tests and knip in app, lathe and desktop; `npm --prefix lathe run check`), gated on real exit codes. The browser suites aren't needed: nothing user-facing changes.
- Never use port 5199.

## Report
- The branch and its last commit.
- The table list, with each kind's columns as one compact table.
- The supertype tables and their members.
- The validation queries DuckDB couldn't express as constraints.
- The interfaces later steps should call, as function signatures.
- The checks run, with their results.
- Every decision you made.
