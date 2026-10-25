# Lathe

Lathe organizes a product's lifecycle (domain model, use cases, interaction design, technical specification, test plan) as records in the product's own repo, checks them, traces them to the code and tests, and serves a web app to browse them. The record format is in [FORMAT.md](FORMAT.md) (the concepts) and [REFERENCE.md](REFERENCE.md) (every kind, relation, folder and check).

## Use it in a product repo

```sh
npm install --save-dev /path/to/jaredrob-lathe-0.1.0.tgz   # until it is published
npx lathe init --name "Tool Library" --prefix TL
npx lathe check
npx lathe format           # the record format reference, as Markdown
npx lathe serve            # http://127.0.0.1:5330
```

## The command

`lathe <command> [options]`. Every command takes `--root <dir>`, the product repo (default: the current folder). `lathe help` (or `--help`) prints the usage.

| Command | What it does |
| --- | --- |
| `init --name <name> --prefix <P>` | Writes `lathe.config.json` (if there is none) and a first product record at `specs/<name>/product.md`. Both options are required; the prefix is capital letters and digits, starting with a letter. It stops if that product record already exists. |
| `check [--json]` | Loads and checks the specs. Prints the errors, then the warnings, then the coverage: one line per domain and obligation kind (designed, built, proved and planned, with the gaps), and one line of test counts (automated, manual, planned). Exits 1 on any error; warnings alone do not fail it. `--json` prints the whole `Workspace` instead. |
| `format [--out <file>]` | Prints the format reference as Markdown: the concepts of [FORMAT.md](FORMAT.md), then every kind, relation (with its labels), folder and check, generated from the meta-model with the product's extensions and from each check's header comment, the product's own checks included. `--out` writes it to a file, relative to the current folder. |
| `serve [--port <n>]` | Serves the web app and its API for the product repo at `http://127.0.0.1:<port>` (default 5330). Open pages reload when the specs change. |

A usage mistake (a missing option, an unknown command, a bad port) exits 2.

## The config

`lathe.config.json`, at the product repo's root, names the product's folders and, optionally, its additions to the meta-model and its settings:

```json
{
  "specs": "specs",
  "metaExtensions": "lathe-meta",
  "checks": "lathe-checks",
  "idPrefixes": ["STD", "SYS"],
  "structure": { "maxChildren": 15 }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `specs` | `specs` | The folder of spec records. Every `*.md` under it is a record, except `README.md`. |
| `metaExtensions` | none | A folder holding a `kinds.csv`, `relations.csv`, `sections.csv` and/or `ids.csv` with the same columns as [meta/](meta/). Their rows are added to Lathe's defaults for this product only, and a row for a kind Lathe already has widens it (FORMAT.md section 9). |
| `checks` | none | A folder of the product's own checks, run after Lathe's (see [Add a product's own check](#add-a-products-own-check)). |
| `idPrefixes` | `[]` | ID prefixes, besides every product's and domain's ID, that a record body may cite: a token such as `STD-04` is then read as a citation and reported if no record has it (FORMAT.md section 12). |
| `structure.maxChildren` | 15 | The most children of one kind a record should have before the `too-many-children` warning (FORMAT.md section 5). A whole number of at least 1. |

Every key is optional. A file that is not valid JSON, a key not in this table, an `idPrefixes` that is not a list of ID prefixes, or a `structure.maxChildren` that is not a whole number of at least 1 is refused when the config is read.

## Build the package

From the Lathe repo:

```sh
npm --prefix lathe run build   # compiles src/ and bin/ to dist/, regenerates REFERENCE.md, and builds the web app into dist/app
cd lathe && npm pack           # writes jaredrob-lathe-<version>.tgz
```

## The engine

The engine turns the product's spec records into a checked database. It:

1. Reads the meta-model: Lathe's `meta/kinds.csv`, `meta/relations.csv`, `meta/sections.csv` (the folders kinds are read in) and `meta/ids.csv` (each kind's ID convention), plus the product's extensions.
2. Reads every `*.md` file in the specs folder except `README.md`, and parses its YAML header and body (see [FORMAT.md](FORMAT.md)). A file it cannot parse becomes a `parse-error` problem, and loading carries on.
3. Works out each record's product and domain by walking its `parent` chain, so a record under a capability or a layer belongs to the domain above it. A loop in that chain is a `parent-cycle` error.
4. Checks each test's `run_by` file and each component's `file`: does it exist, and which of the test's own ID and the IDs it proves does the file mention.
5. Reads the IDs each body cites (FORMAT.md section 12), and each entity's and domain event's Fields table (sections 17 and 18).
6. Loads all of this into an in-memory DuckDB database, runs every check in `lathe/checks/` (including checks that the meta-model itself is consistent) and then the product's own checks, and computes coverage per domain: how many obligations are designed (a component satisfies them), built (that component's file exists), proved (an automated or manual test proves them) and planned (only a planned test does).

Nothing is written to disk. The files are the source of truth, and the database is rebuilt on every load.

## The API

```ts
import { loadWorkspace, formatReference, renderReference, loadConfig } from '@jaredrob/lathe';

const workspace = await loadWorkspace('/path/to/repo');       // kinds, sections, relations, records, links, problems, coverage
const markdown = renderReference(await formatReference('/path/to/repo'));  // what `lathe format` prints
const config = loadConfig('/path/to/repo');                  // the resolved lathe.config.json
```

The types are in [src/types.ts](src/types.ts) (`Workspace` and its parts) and [src/reference.ts](src/reference.ts) (`FormatReference`). Each entity and domain event record carries its fields, read from the Fields table in its body (`entityFields`), for the app's ERDs.

`lathe serve` and the app's dev server share one HTTP API ([src/server/api.ts](src/server/api.ts)):

| Request | Answer |
| --- | --- |
| `GET /api/spec` | The whole `Workspace`. |
| `GET /api/format` | The `FormatReference`: the concepts, kinds, relations, folders and checks. |
| `GET /api/events` | Server-sent events: `spec:changed` when the files change. |

## Work on Lathe itself

The npm scripts run in `lathe/`, so a relative `--root` is read from there: `..` is this repo.

```sh
npm --prefix lathe install
npm --prefix lathe run check                          # check this repo (Lathe dogfooding itself)
npm --prefix lathe run check -- --json                # print the whole Workspace as JSON
npm --prefix lathe run lathe -- check --root <dir>    # any command, against another root
npm --prefix lathe run lathe -- format --root ..      # this repo's reference, its own checks included
npm --prefix lathe run reference                      # regenerate REFERENCE.md after changing FORMAT.md, meta/ or checks/
```

In this repo the CLI runs from source on Node 26's built-in TypeScript support; the package ships compiled JavaScript, because Node does not run TypeScript from `node_modules`. `REFERENCE.md` holds Lathe's defaults only; a test fails when it is out of date.

## Tests and type checks

```sh
npm --prefix lathe test          # vitest, at most 2 workers
npm --prefix lathe run typecheck # tsc --noEmit
```

The fixture workspaces in `test/fixtures/` are small: `good` passes every check, and each `broken-*` breaks one group of checks on purpose.

## The database the checks see

| Table | Columns |
| --- | --- |
| `kinds` | `kind`, `label`, `stage`, `section`, `parent_kinds` (list), `required_fields` (list), `obligation` (true for `yes` or `proof`), `proof_only` (true for `proof`), `description` |
| `relations` | `relation`, `source_kind`, `target_kind` (`*` means any kind), `role` (`design`, `proof` or empty), `description`, `forward_label`, `reverse_label` |
| `sections` | `section`, `stage`, `order`, `label`, `description`: the folders kinds are read in |
| `kind_ids` | `kind`, `pattern`, `example`: each kind's ID convention, from `ids.csv` |
| `records` | `path`, `id`, `kind`, `title`, `parent`, `product`, `domain`, `body` |
| `fields` | `path`, `record`, `name`, `value`: every plain header field that is not `id`, `kind`, `title`, `parent` or `links` |
| `links` | `path`, `source`, `relation`, `target` |
| `file_facts` | `path`, `record`, `kind` (`test` or `component`), `file`, `file_exists`, `contains_id` (tests only) |
| `file_mentions` | `path`, `record`, `mentioned`: each of a test's own ID and its link targets that its `run_by` file mentions |
| `prose_mentions` | `path`, `record`, `cited`: each distinct ID a record's body cites, whether or not a record has it |
| `entity_tables` | `path`, `record`, `heading` (the body has a `## Fields` heading), `columns` (the table's header cells, joined by `, `; NULL without a table), `columns_ok`: one row per entity and domain event |
| `entity_fields` | `path`, `record`, `position` (from 1), `field`, `meaning`, `kind`, `example`: one row per row of a Fields table whose columns are right |
| `settings` | `name`, `value`: the settings from `lathe.config.json` that checks read, such as `structure.maxChildren` (always present, with its default when the config does not give it) |
| `check_docs` | `source`, `"check"`, `origin` (`lathe` or `product`), `summary`, `explanation`, `severity`, `missing`: what each check file's header says, and what it lacks |
| `meta_kind_rows`, `meta_relation_rows` | `folder` and the kind, or the relation with its source and target kinds: each meta-model row as read, for the meta-model checks |

`path` is the record file's path relative to the root. It is unique, so use it to join a record to its own fields and links. IDs can be duplicated in a broken workspace. A missing `id`, `kind` or `title` is stored as an empty string, and a missing `parent` as NULL.

## Add a check

1. Add a file to `lathe/checks/` named `<number>-<check-name>.sql`, such as `76-view-without-endpoint.sql`. The checks run in file name order. The name without the number and `.sql` is the check's name.
2. Write one `SELECT` that returns the columns `severity` (`'error'` or `'warning'`), `"check"`, `record` (the ID, or NULL) and `message`, with one row per problem. Quote `"check"`, because `CHECK` is an SQL keyword; the file name, not this column, names the check. Write the message as a plain sentence that names the IDs involved.
3. Use `error` when the workspace is broken, and `warning` for work still to do.
4. Start the file with its header comment, which is its documentation in the reference: one summary sentence, a blank comment line, the explanation ending with how to fix what it reports, a blank comment line, then `-- severity: error` (or `warning`, or `error, warning`) and, optionally, `-- kinds: use_case requirement` for the kinds it concerns. A header that lacks any of these is an `undocumented` error.
5. Add a fixture and a test in `test/checks.test.ts`, and run `npm --prefix lathe run reference` to regenerate REFERENCE.md.

If a check's SQL fails to run, the engine reports that as an error problem for that check rather than crashing.

## Add a product's own check

A rule that belongs to one product, not to Lathe, goes in the product's own `checks` folder (FORMAT.md section 13). This repo's `lathe.config.json` names `lathe-checks/`, which holds `01-endpoint-without-interaction-requirement.sql` and `02-actor-not-a-role.sql`.

1. Name the folder in `lathe.config.json`: `"checks": "lathe-checks"`.
2. Add `<number>-<check-name>.sql` files to it, written as Lathe's checks are (steps 1 to 4 above, header included), against the same tables.
3. They run after all of Lathe's checks, in file name order, and their problems are reported with the others. `lathe format` lists them with Lathe's.

A product check named like one of Lathe's checks is not run and is a `product-check-name-clash` error; a product check that fails to run is an error naming its file; and a `checks` folder that does not exist is a `product-checks-missing` error.
