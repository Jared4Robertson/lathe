# Brief: the Lathe engine

Read [00-common-rules.md](00-common-rules.md) first.

## Goal
Build the engine that loads every spec record from Markdown files, checks it against the meta-model with DuckDB, and computes traceability coverage. The web app and a CLI both call it. This is what turns a folder of documents into a checked database.

## Scope
- Read first: `lathe/FORMAT.md`, `lathe/meta/*.csv`, `lathe/src/types.ts`, `lathe/fixtures/workspace.sample.json`, and `app/server/model.ts` (how the app already uses `@duckdb/node-api`).
- You own: `lathe/package.json`, `lathe/package-lock.json`, `lathe/tsconfig.json`, `lathe/.gitignore`, `lathe/README.md`, `lathe/src/**` except `types.ts`, `lathe/checks/**`, `lathe/test/**`, `lathe/bin/**`.
- Out of scope: any spec content under `specs/`, the web app under `app/`.

## What to build
1. `lathe/src/index.ts` exporting `loadWorkspace(root: string): Promise<Workspace>` (types from `./types`). `root` is the repo root.
   - Read `lathe/meta/kinds.csv` and `lathe/meta/relations.csv` (space-separated lists become arrays).
   - Find every `specs/**/*.md` except `README.md`. Parse the YAML header with the `yaml` package. `id`, `kind`, `title`, `parent` and `links` are structural; every other plain string header field goes into `fields`. Body is everything after the header, trimmed.
   - A file that cannot be parsed (no header, bad YAML, non-string field values, `links` not a map of lists) becomes an error problem `parse-error` with the path in the message; loading carries on.
   - Compute each record's `product` and `domain` by walking `parent` (a cycle is an error `parent-cycle`; stop walking).
   - For tests and components, precompute file facts in TypeScript (does `run_by`/`file` exist under root; does the `run_by` file contain the test's ID) and load them as a table, so the checks stay in SQL.
   - Load records, fields, links, kinds, relations and file facts into in-memory DuckDB tables, run every `lathe/checks/*.sql` in name order, and collect their rows. Each check file is one `SELECT severity, check, record, message ...` query; the file name (without number prefix and `.sql`) is the check name.
   - Compute `coverage` per domain with SQL: requirements and domain rules, how many have a `satisfies` link from a component, how many have a `proves` link from a test, and the gaps.
2. Checks, one SQL file each, numbered: errors `duplicate-id`, `bad-id`, `unknown-kind`, `missing-title`, `missing-parent`, `unknown-parent`, `parent-kind-not-allowed`, `product-has-parent`, `missing-required-field`, `unknown-relation`, `relation-not-allowed` (honour `*` as any target kind), `dangling-link`, `test-file-missing`, `test-file-missing-id`; warnings `unsatisfied`, `unproved`, `use-case-without-requirements`, `component-file-missing`. Messages are plain sentences naming the IDs involved.
3. CLI: `npm --prefix lathe run check` (via `lathe/bin/lathe.ts`, run with Node 26's built-in TypeScript support or `tsx`) prints errors, then warnings, then one coverage line per domain, and exits 1 if there is any error. `--json` prints the whole `Workspace` as JSON instead.
4. `lathe/README.md`: what the engine does, how to run the CLI, how to add a check.

## Tests (required, with these exact names)
Use vitest. Build small fixture workspaces under `lathe/test/fixtures/` (a good one and broken ones). Put these tests in `lathe/test/checks.test.ts`, named exactly as below, because Lathe's own spec cites these IDs:
- `LA-CHK-T01 Duplicate IDs are reported as errors`
- `LA-CHK-T02 A link to a missing record is reported as an error`
- `LA-CHK-T03 A disallowed relation is reported as an error`
- `LA-CHK-T04 A test whose run_by file lacks its ID is reported as an error`
- `LA-CHK-T05 Coverage counts satisfied and proved requirements`
- `LA-CHK-T06 A malformed record file becomes a parse error, not a crash`

Add further tests for the other checks as you see fit (any names).

## Decisions already made
- Files are the source of truth; DuckDB is in-memory and rebuilt on every load. No database file is written.
- `@duckdb/node-api` (same as the app) and `yaml` are the dependencies; keep others minimal.

## Checks to run
`npx tsc --noEmit -p lathe` and `npm --prefix lathe test` (max 2 workers). Run the CLI against your good fixture and against the repo root (which may have no specs yet in your branch).
