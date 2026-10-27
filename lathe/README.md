# Lathe

Lathe keeps a product's lifecycle (domain model, use cases, interaction design, technical specification, test plan) as typed data in the product's own repo, checks it, traces it to the code and tests, and serves a web app to browse and edit it. Every table, column, relation and check is listed in [REFERENCE.md](REFERENCE.md), generated from the schema and the check rows.

## Use it in a product repo

```sh
npm install --save-dev /path/to/jaredrob-lathe-0.1.0.tgz   # until it is published
npx lathe init --name "Tool Library" --prefix TL
npx lathe add domain --id TL-LEND --title Lending --product_id TL
npx lathe check
npx lathe serve            # http://127.0.0.1:5330
```

## The data model

- **A table per kind.** A domain, an aggregate, a use case, a requirement, a test and every other kind of record has a table of its own, with typed columns: a requirement's one-sentence `statement`, a test's `given`, `when` and `then` and its `state`. Long notes exist only where a kind declares a `notes` column.
- **Containment is a foreign key.** A requirement names its use case in `use_case_id`, an entity its aggregate in `aggregate_id`. A record's parent is the first of its kind's parent columns that holds a value; its product and domain follow from there.
- **Parts are rows of their own.** An entity's fields are `entity_field` rows, a use case's actors and steps are `use_case_actor` and `use_case_step` rows, a pattern's settings are `pattern_setting` rows and a follower's answers are `setting_value` rows. They go with their record when it is removed.
- **A link is a row of its relation's table.** `proves` holds (`source_id`, `target_id`) pairs. Where a relation may target several kinds, it points at a supertype table such as `obligation` (every requirement, domain rule, interaction requirement and pattern rule), so every link has a real foreign key.
- **IDs are unique across every kind.** The `record_id` registry holds every ID with its kind, so a bare ID resolves.
- **The schema is the meta-model.** It is the numbered SQL migrations in [schema/](schema/), applied in order to DuckDB, with a comment on every table and column. A new column comes by a new migration; `npm --prefix lathe run schema` then regenerates the row types in [src/store/tables.ts](src/store/tables.ts).
- **A product may add its own kinds and relations** as `product_kind`, `product_kind_field` and `product_relation` rows. Lathe generates a table for each, with the same keys and rules as its own kinds. Lathe's own kinds cannot be widened; that is a migration.

What the schema enforces is never a check: data with a missing parent, a link to nothing, a value outside its enum, a duplicate ID or a link across products cannot be saved.

## The data folder

The source of truth is `data/<table>.jsonl` at the product repo's root: one file per stored table with rows, one JSON object per line, rows sorted by key, columns in the table's order, columns without a value left out, UTF-8 with a trailing newline. A change to a row is a one-line diff, and git is the history: `git log` and `git blame` show what changed, when, and whether the Owner or an Agent made it. The database is built in memory on each load and never committed.

`lathe.config.json`, at the root, is optional:

```json
{ "data": "data" }
```

| Key | Default | Meaning |
| --- | --- | --- |
| `data` | `data` | The folder of data files. |

Any other key, or a file that is not one JSON object, is refused when the config is read. A product's settings are data too: `product_setting.max_children` (15 when the product has no row) is the most children of one kind a record has before the `too-many-children` warning.

## Changing the data

Every change goes through the command layer, which validates it in one transaction (every key, rule and validation query) and only then rewrites the lines it changed. Nobody edits the files by hand.

- **The CLI.** `lathe add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list` and `next-id`, with flags and help generated from the schema (`lathe add --help`, `lathe add requirement --help`). A refusal prints every reason, with the rule it broke, and changes nothing.
- **The app.** Each record page edits the record in place with a form generated from the schema.
- **The Claude Code plugin.** Its MCP tools (`lathe mcp`) expose the same operations to an Agent.
- **Code.** `openStore` gives the same command layer:

```ts
import { openStore } from '@jaredrob/lathe';

const store = await openStore('/path/to/repo');           // loads data/*.jsonl, or throws a StoreError naming file, line and rule
await store.add('requirement', { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
await store.link('proves', 'TL-LEND-T03', 'TL-LEND-UC01-R02');
const rows = await store.query('SELECT id, title FROM requirement');
await store.close();
```

## The merge driver

Two branches that each add rows to the same file would clash line by line in git's own merge. `lathe merge-data` merges data files row by row instead, keeping both sides' rows against the base, and fails only on a real clash: one key added on both sides with different content, or one row changed on both sides. The repo's `.gitattributes` names it for the data files (`**/data/*.jsonl merge=lathe-data`), and each clone sets it up once:

```sh
git config merge.lathe-data.name "Lathe data files"
git config merge.lathe-data.driver "npx lathe merge-data %O %A %B %P"
```

The driver checks the merged table's own rules (columns, types, keys and checks); keys to other tables are checked when the data next loads, since the other files may still be mid-merge.

## The command

`lathe <command> [options]`. Every command takes `--root <dir>`, the product repo (default: the current folder). `lathe help` prints the usage, the data commands included.

| Command | What it does |
| --- | --- |
| `init --name <name> --prefix <P>` | Writes `lathe.config.json` (if there is none) and adds the product record to `data/product.jsonl` through the store. Both options are required; the prefix is capital letters and digits, starting with a letter. It stops if that product already exists. |
| `check [--json]` | Loads the data and checks it. Prints the errors, then the warnings, then the coverage: one line per domain and obligation kind (designed, built, proved and planned, with the gaps), and one line of test counts. Exits 1 on any error, data the store refuses included; warnings alone do not fail it. `--json` prints the whole `Workspace` instead. |
| `serve [--port <n>]` | Serves the web app and its API at `http://127.0.0.1:<port>` (default 5330). Open pages reload when the data changes. |
| `merge-data <base> <ours> <theirs> <path>` | Git's merge driver for the data files (see [The merge driver](#the-merge-driver)). |
| `mcp` | Serves the data commands as MCP tools over stdio, for the Claude Code plugin. |
| `add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list`, `next-id` | The data commands (see [Changing the data](#changing-the-data)). |

A usage mistake (a missing option, an unknown command, a bad port) exits 2.

## The engine

`loadWorkspace(root)`:

1. Opens the store: reads `data/*.jsonl`, and Lathe's own `data/check.jsonl` from this package beside it, into the typed tables, with every key, rule and validation query. Data the store refuses becomes `data-refused` errors naming the file, line and rule, and nothing else is checked until it is fixed.
2. Scans the code: each test's `file` (or its `key_file`) and each component's `file`, into `file_facts` (does it exist, does a test's file name the test's own ID or its `key`) and `file_mentions` (which of the test's own ID and its link targets the file names).
3. Creates the coverage views over the typed tables (see below) and runs every check row: Lathe's in position order, then each product's. A product's check reports only on records of its product.
4. Reads coverage per domain from the views.

Nothing is written to disk.

```ts
import { loadWorkspace, buildReference, renderReference } from '@jaredrob/lathe';

const workspace = await loadWorkspace('/path/to/repo');       // kinds, sections, relations, records, links, problems, coverage
const markdown = renderReference(await buildReference('/path/to/repo'));  // the reference, with the product's own kinds and checks
```

The types are in [src/types.ts](src/types.ts) (`Workspace` and its parts: each record carries its typed columns as `fields` and its part rows as `parts`) and [src/reference.ts](src/reference.ts) (`Reference`).

`lathe serve` and the app's dev server share one HTTP API ([src/server/api.ts](src/server/api.ts)):

| Request | Answer |
| --- | --- |
| `GET /api/spec` | The whole `Workspace`. |
| `GET /api/reference` | The `Reference`: kinds, tables, relations, folders and checks. |
| `GET /api/history?id=<ID>` | The commits that changed the record's row, newest first (`&commit=<hash>` for one commit's change of the row). |
| `GET /api/events` | Server-sent events: `spec:changed` when a data file changes. |

## Checks

A check is a row of the `check` table: its `name`, `position`, `severity` (`error`, `warning`, or `error_or_warning` when each row says which), a one-sentence `summary`, an `explanation` ending with how to fix what it reports, the `kinds` it concerns, and its `query`. The query lives in the row, and nowhere else: one `SELECT` over the tables that returns `record` (an ID, or NULL) and `message`, plus `severity` when the check's severity is `error_or_warning`, with one row per problem. Write the message as a plain sentence naming the IDs involved. Use `error` when the data is broken and `warning` for work still to do; a rule the schema could enforce belongs in a migration, not a check.

Lathe's checks are in this package's [data/check.jsonl](data/check.jsonl), loaded beside every product's data and never written by a product's writes. A product's own checks are rows of its own `data/check.jsonl` with its `product_id`; this repo's are `endpoint-without-interaction-requirement` and `actor-not-a-role`. A name is unique across both, so a product check cannot take one of Lathe's names. Add one with `lathe add check --name ... --query ...`, or through the app.

A query can read every typed table, the `record_parent`, `record_scope` and `link` views, the `meta_*` tables, and what the engine adds for the checks:

| Table or view | Columns |
| --- | --- |
| `file_facts` | `record`, `kind` (`test` or `component`), `file`, `file_exists`, `contains_id` (tests only), `key_file`, `key_file_inside`, `key_file_exists` |
| `file_mentions` | `record`, `mentioned`: each of a test's own ID and its link targets that its file names |
| `owed_pattern_rules` | `domain`, `id`, `kind`: each pattern rule a domain owes, as a follower of its pattern, unless not applicable or waived there |
| `obligation_kind` | `kind`, `label`, `proof_only`, `ord`: the obligation kinds in schema order |
| `role_link` | each design or proof link to an obligation, with its source's kind, domain and state, and whether its claim is backed by the test's file |
| `coverage_item` | `domain`, `id`, `kind`, `per_domain`, `designed`, `built`, `proved`, `planned_proof`: each obligation a domain owes |
| `coverage_count`, `coverage_gap`, `coverage_tests` | the per-domain counts, the gaps and the tests by state |

If a check's query fails to run, the engine reports that as an error under the check's name rather than crashing. After adding or changing one of Lathe's checks, run `npm --prefix lathe run reference` to regenerate REFERENCE.md; a test fails when it is out of date.

## Work on Lathe itself

The npm scripts run in `lathe/`, so a relative `--root` is read from there: `..` is this repo.

```sh
npm --prefix lathe install
npm --prefix lathe run check                          # check this repo (Lathe dogfooding itself)
npm --prefix lathe run check -- --json                # print the whole Workspace as JSON
npm --prefix lathe run lathe -- check --root <dir>    # any command, against another root
npm --prefix lathe run reference                      # regenerate REFERENCE.md after a migration or a change to Lathe's checks
npm --prefix lathe test                               # vitest, at most 2 workers
npm --prefix lathe run typecheck                      # tsc --noEmit
npm --prefix lathe run test:perf                      # the engine's performance budgets
```

In this repo the CLI runs from source on Node 26's built-in TypeScript support; the package ships compiled JavaScript, because Node does not run TypeScript from `node_modules`. The test fixtures in `test/fixtures/` are small product roots, each with a `data/` folder written by the store: `good` passes every check, and the others hold the cases their tests name.

## Build the package

```sh
npm --prefix lathe run build   # compiles src/ and bin/ to dist/, regenerates REFERENCE.md, and builds the web app into dist/app
cd lathe && npm pack           # writes jaredrob-lathe-<version>.tgz
```
