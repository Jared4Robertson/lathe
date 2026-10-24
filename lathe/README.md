# Lathe

Lathe organises a product's lifecycle (domain model, use cases, interaction design, technical specification, test plan) as records in the product's own repo, checks them, traces them to the code and tests, and serves a web app to browse them.

## Use it in a product repo

```sh
npm install --save-dev /path/to/jaredrob-lathe-0.1.0.tgz   # until it is published
npx lathe init --name "Tool Library" --prefix TL
npx lathe check
npx lathe serve            # http://127.0.0.1:5330
```

`lathe init` writes `lathe.config.json` and a first product record. The config names the product's folders and, optionally, its own additions to the meta-model:

```json
{
  "specs": "specs",
  "diagrams": "diagrams",
  "metaExtensions": "lathe-meta"
}
```

All three keys are optional (`specs` and `diagrams` are the defaults). A `metaExtensions` folder holds a `kinds.csv` and/or `relations.csv` with the same columns as [meta/](meta/); their rows are added to Lathe's defaults for this product only, and a row for a kind Lathe already has widens that kind (see FORMAT.md section 9). The record format is in [FORMAT.md](FORMAT.md).

## Build the package

From the Lathe repo:

```sh
npm --prefix lathe run build   # compiles src/ and bin/ to dist/, and builds the web app into dist/app
cd lathe && npm pack           # writes jaredrob-lathe-<version>.tgz
```

## The engine

The engine turns the product's spec records into a checked database. It:

1. Reads the meta-model: Lathe's `meta/kinds.csv` and `meta/relations.csv`, plus the product's extensions.
2. Reads every `*.md` file in the configured specs folder except `README.md`, and parses its YAML header and body (see [FORMAT.md](FORMAT.md)). A file it cannot parse becomes a `parse-error` problem, and loading carries on.
3. Works out each record's product and domain by walking its `parent` chain. A loop in that chain is a `parent-cycle` error.
4. Checks each test's `run_by` file and each component's `file`: does it exist, and does a test's file mention the test's ID.
5. Loads all of this into an in-memory DuckDB database, runs every check in `lathe/checks/` (including checks that the meta-model itself is consistent), and computes coverage per domain: how many requirements and domain rules are designed (a component satisfies them), built (that component's file exists) and proved (a test proves them).

It returns a `Workspace` (see [src/types.ts](src/types.ts)): kinds, relations, records, links, problems and coverage. Nothing is written to disk. The files are the source of truth, and the database is rebuilt on every load.

```ts
import { loadWorkspace } from '@jaredrob/lathe';
const workspace = await loadWorkspace('/path/to/repo');
```

## Work on Lathe itself

```sh
npm --prefix lathe install
npm --prefix lathe run check                          # check this repo (Lathe dogfooding itself)
npm --prefix lathe run lathe -- check --root path     # any command, against another root
npm --prefix lathe run check -- --json                # print the whole Workspace as JSON
```

`check` prints errors, then warnings, then one coverage line per domain. It exits 1 if there is any error. Warnings alone do not fail it. In this repo the CLI runs from source on Node 26's built-in TypeScript support; the package ships compiled JavaScript, because Node does not run TypeScript from `node_modules`.

## Tests and type checks

```sh
npm --prefix lathe test          # vitest, at most 2 workers
npm --prefix lathe run typecheck # tsc --noEmit
```

The fixture workspaces in `test/fixtures/` are small: `good` passes every check, and each `broken-*` breaks one group of checks on purpose.

## The database the checks see

| Table | Columns |
| --- | --- |
| `kinds` | `kind`, `label`, `stage`, `parent_kinds` (list), `required_fields` (list), `description` |
| `relations` | `relation`, `source_kind`, `target_kind` (`*` means any kind), `description` |
| `records` | `path`, `id`, `kind`, `title`, `parent`, `product`, `domain`, `body` |
| `fields` | `path`, `record`, `name`, `value`: every plain header field that is not `id`, `kind`, `title`, `parent` or `links` |
| `links` | `path`, `source`, `relation`, `target` |
| `file_facts` | `path`, `record`, `kind` (`test` or `component`), `file`, `file_exists`, `contains_id` (tests only) |

`path` is the record file's path relative to the root. It is unique, so use it to join a record to its own fields and links. IDs can be duplicated in a broken workspace. A missing `id`, `kind` or `title` is stored as an empty string, and a missing `parent` as NULL.

## Add a check

1. Add a file to `lathe/checks/` named `<number>-<check-name>.sql`, such as `19-view-without-endpoint.sql`. The checks run in file name order. The name without the number and `.sql` is the check's name.
2. Write one `SELECT` that returns the columns `severity` (`'error'` or `'warning'`), `"check"`, `record` (the ID, or NULL) and `message`, with one row per problem. Quote `"check"`, because `CHECK` is an SQL keyword. Write the message as a plain sentence that names the IDs involved.
3. Use `error` when the workspace is broken, and `warning` for work still to do.
4. Add a fixture and a test in `test/checks.test.ts`.

If a check's SQL fails to run, the engine reports that as an error problem for that check rather than crashing.
