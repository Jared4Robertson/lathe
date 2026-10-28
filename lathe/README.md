# Lathe

Lathe keeps a product's lifecycle (discovery, domain model, use cases, interaction design, technical specification, test plan) as typed data in the product's own repo, checks it, traces it to the code and tests, and serves a web app to browse and edit it. Every table, column, relation and check is listed in [REFERENCE.md](REFERENCE.md), generated from the schema and the check rows.

## Use it in a product repo

```sh
npm install --save-dev /path/to/jaredrob-lathe-1.0.0.tgz   # until it is published
npx lathe init --name "Tool Library" --prefix TL
npx lathe add domain --id TL-LEND --title Lending --product_id TL
npx lathe check
npx lathe serve            # http://127.0.0.1:5330
```

## The data model

- **One concrete model.** Kinds are drawn from domain-driven design, CQRS and event storming, in six stages: discovery (the business outcomes a product exists to achieve, each measurable, which its capabilities serve), the domain model (aggregates, entities, value objects, constraints, invariants, specifications, events, commands, read models, queries, policies, domain services, terms), use cases (capabilities, use cases, UC requirements, patterns), interaction design (flows and their steps, views, endpoints, integrations, view and API requirements), the technical specification (one technical kind implements each design kind: a command's command handler, an entity's data model and table, and so on) and the test plan (one test kind per thing tested, each with its run by: level, state, file, size and markers, and the test data sets tests start from). Clean architecture's "use case" is what Lathe calls a command handler.
- **A table per kind.** Every kind of record has a table of its own, with typed columns: a UC requirement's one-sentence `statement`, a test's run by (`level`, `state`, `file` or `manual_reason`).
- **One parent, as a foreign key.** A UC requirement names its use case in `use_case_id`, an entity its aggregate in `aggregate_id`; an endpoint sits under its command or its query. Value objects, specifications, views, integrations and UI components have no owner: they exist because other records use them, and take their product (or a specification its domain) from their ID.
- **Parts are rows of their own.** An entity's fields are `entity_field` rows, a use case's actors are `use_case_actor` rows, a table's keys are `table_key` rows, a pattern's settings are `pattern_setting` rows and a follower's answers are `setting_value` rows. They go with their record when it is removed.
- **A link is a row of its relation's table.** `fulfills` holds (`source_id`, `target_id`) pairs, a flow step and the UC requirement it fulfills. Where a relation may link several kinds, an end points at a supertype table such as `operation` (every command and query), so every link has a real foreign key.
- **IDs are unique across every kind.** The `record_id` registry holds every ID with its kind, so a bare ID resolves.
- **The schema is the meta-model.** It is the numbered SQL migrations in [schema/](schema/), applied in order to DuckDB, with a comment on every table and column. A new column comes by a new migration; `npm --prefix lathe run schema` then regenerates the row types in [src/store/tables.ts](src/store/tables.ts).
- **A product may add its own kinds and relations** as `product_kind`, `product_kind_field` and `product_relation` rows. Lathe generates a table for each, with the same keys and rules as its own kinds. Lathe's own kinds cannot be widened; that is a migration.

What the schema enforces is never a check: data with a missing parent, a link to nothing, a value outside its enum, a duplicate ID or a link across products cannot be saved.

## The data folder

The source of truth is `data/<table>.jsonl` at the product repo's root: one file per stored table with rows, one JSON object per line, rows sorted by key, columns in the table's order, columns without a value left out, UTF-8 with a trailing newline. A change to a row is a one-line diff, and git is the history: `git log` and `git blame` show what changed, when, and whether the Owner or an Agent made it. The database is built in memory on each load and never committed.

`lathe.config.json`, at the root, is written by `lathe init`:

```json
{ "schema": 2, "data": "data" }
```

| Key | Default | Meaning |
| --- | --- | --- |
| `schema` | `1` | The schema version the data is for (see [Upgrading](#upgrading)). |
| `data` | `data` | The folder of data files. |
| `tests` | `["**/*.test.{ts,tsx,js,mjs}", "**/*.spec.{ts,tsx,js}"]` | Globs of the test files, from the root. |
| `source` | code in the common languages (`**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,vue,svelte,py,rb,go,rs,java,kt,swift,cs,php}`) | Globs of the source files, from the root. Each must be named by a technical record, directly or through a folder one names, or coverage lists it as a `code-file-untraced` gap. Tests (the `tests` globs, and files in `test`, `tests`, `__tests__`, `__mocks__` or `fixtures` folders), configs (`*.config.*`, `.*rc` files, `*.d.ts`), generated files (`@generated`, or "generated" and "do not edit", in the first five lines), `node_modules`, build output (`dist`, `build`, `out`, `coverage`), dot-folders and another product's folder are left out whatever the globs. |
| `routers` | none | Glob patterns, from the root, of the files besides the endpoint handlers' that declare the routes the product serves (a server's entry, a client's route table). `lathe check` reads them and the handlers' files for served routes, and lists each one no endpoint or view has as a `route-without-record` gap. |

Any other key, or a file that is not one JSON object, is refused when the config is read. A product's settings are data too: `product_setting.max_children` (15 when the product has no row) is the most children of one kind a record has before the `too-many-children` warning. `product_setting.max_entities_per_aggregate` (7 when the product has no row) is the most entities an aggregate has before the `aggregate-too-large` warning; a settings row gives both.

## Changing the data

Every change goes through the command layer, which validates it in one transaction (every key, rule and validation query) and only then rewrites the lines it changed. Nobody edits the files by hand.

- **The CLI.** `lathe add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list` and `next-id`, with flags and help generated from the schema (`lathe add --help`, `lathe add uc_requirement --help`). A refusal prints every reason, with the rule it broke, and changes nothing.
- **The app.** Each record page edits the record in place with a form generated from the schema.
- **The Claude Code plugin.** Its MCP tools (`lathe mcp`) expose the same operations to an Agent.
- **Code.** `openStore` gives the same command layer:

```ts
import { openStore } from '@jaredrob/lathe';

const store = await openStore('/path/to/repo');           // loads data/*.jsonl, or throws a StoreError naming file, line and rule
await store.add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
await store.link('fulfills', 'TL-LEND-UC01-FL01-S01', 'TL-LEND-UC01-R02');
const rows = await store.query('SELECT id, title FROM uc_requirement');
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
| `init --name <name> --prefix <P>` | Writes `lathe.config.json` (if there is none) with this Lathe's schema version, and adds the product record to `data/product.jsonl` through the store. Both options are required; the prefix is capital letters and digits, starting with a letter. It stops if that product already exists. |
| `check [--json]` | Loads the data and checks it. Prints the errors, then the warnings, then the coverage: for each domain, and for the product outside the domains, one line per obligation kind (designed, built and proved out of the total, and how many wait on a test not automated yet, with each gap), a line of test counts, and the records short of a minimum. Exits 1 on any error, data the store refuses included; warnings alone do not fail it. `--json` prints the whole `Workspace` instead. |
| `upgrade [--allow-dirty]` | Moves the data forward to this Lathe's schema version (see [Upgrading](#upgrading)). |
| `serve [--port <n>]` | Serves the web app and its API at `http://127.0.0.1:<port>` (default 5330). Open pages reload when the data changes. |
| `merge-data <base> <ours> <theirs> <path>` | Git's merge driver for the data files (see [The merge driver](#the-merge-driver)). |
| `mcp` | Serves the data commands as MCP tools over stdio, for the Claude Code plugin. |
| `add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list`, `next-id` | The data commands (see [Changing the data](#changing-the-data)). |

A usage mistake (a missing option, an unknown command, a bad port) exits 2.

## Upgrading

Lathe's schema has a version: one whole number in [schema/version.json](schema/version.json), 1 for the first versioned schema, 2 since each flow goes through an interface (converter `upgrades/1-to-2.ts`). A product's `lathe.config.json` names the version its data is for (none is 1). Every load (`lathe check`, the data commands, `lathe serve`, the MCP tools, `loadWorkspace` and `openStore`) stops on data for another version, with one message and nothing read: data for an older schema says to run `npx lathe upgrade`; data for a newer one says the product needs a newer Lathe.

**Versions.** The package follows semantic versioning, and its major version tracks the schema: a breaking schema change (a table, column or rule that existing data may not pass, such as a renamed or removed column or a new required one) raises the schema version by one, adds a converter, and raises the major version. A new kind, an optional column or a new check is a minor version; a fix is a patch. Two releases with the same major version read the same data.

**Upgrading a product.** Update `@jaredrob/lathe` in the product repo, commit, then:

```sh
npx lathe upgrade
```

It runs each converter in order from the product's schema version to this Lathe's, prints what each changed, then a list of what it could not convert, for you to finish by hand (nothing is silently dropped), and raises `schema` in `lathe.config.json`. It refuses a git working tree with changes, so the whole upgrade is one commit to review with `git diff`; `--allow-dirty` upgrades anyway. If the converted data does not load under the new schema, it stops before raising the version and lists the store's refusals as the to-dos; `git checkout -- .` undoes it. The upgrade goes one way: nothing old is kept, and no Lathe reads the old form afterwards.

**Writing a converter.** A breaking schema change comes with `upgrades/<from>-to-<to>.ts`, moving the data forward exactly one version (`1-to-2.ts`). Its default export has up to two phases:

```ts
import type { Converter } from '../src/index.ts';

export default {
  // What the new schema cannot load as it is, on the raw rows of the data files.
  files(data, notes) {
    data.write('product', data.read('product').map(({ notes: delivery, ...row }) => ({ ...row, delivery })));
    notes.changed('product.notes is now product.delivery');
  },
  // Everything else, through the store's command layer, once the data loads.
  async records(store, notes) {
    for (const row of store.rows('product')) if (!row.delivery) notes.todo(`${row.id}: write how it is delivered`);
  },
} satisfies Converter;
```

Every converter's `files` phase runs in order, then every `records` phase in order: the store is Lathe's current one, so the files phases bring the data to a shape it loads. A table a files phase rewrites takes the store's own order and line format. `notes.changed` lines are the summary; `notes.todo` lines are the to-do list. Test each converter on a copy of a real product before release; [test/cli/upgrade.test.ts](test/cli/upgrade.test.ts) shows the whole path with a test converter.

## The engine

`loadWorkspace(root)`:

1. Opens the store: reads `data/*.jsonl`, and Lathe's own `data/check.jsonl` from this package beside it, into the typed tables, with every key, rule and validation query. Data the store refuses becomes `data-refused` errors naming the file, line and rule, and nothing else is checked until it is fixed.
2. Scans the code: the `file` of every technical record and test (and of a product's own kind with a file field), into `file_facts`: does it exist (a technical record's may be a folder), and does it name the record's own ID as a whole ID.
3. Works out coverage (see below) and runs every check row: Lathe's in position order, then each product's. A product's check reports only on records of its product.
4. Reads coverage per domain, and per product outside the domains.

**Coverage.** Every obligation (constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule, standard rule, and a product's own obligation kinds) is counted as:

- **designed:** a UC requirement once a step of each of its use case's flows (one per interface) fulfills it, a standard rule once a technical record meets it, a product's own obligation once a design link targets it; the others by construction (a pattern rule wherever a following domain owes it);
- **built:** the technical record that implements it names a file that exists: a constraint's value type, an invariant's data model or the table whose unique key names it, a specification's predicate, a policy's event handler, a domain service's service, a UC requirement's command or query handler or the UI component of the view its step happens in, a view requirement's UI component, an API requirement's endpoint handler. A pattern rule asks for proof only;
- **proved:** a test of it is automated or manual, at a run by level its test kind allows (`ALLOWED_LEVELS` in [src/coverage.ts](src/coverage.ts)), and an automated test's file names the test's ID. A pattern rule is proved in each domain that owes it by its pattern rule test naming that domain.

Coverage also lists, as gaps, the records short of a minimum the schema leaves open while stages are written one by one (`GAP_RULES`): a use case with no flow, an aggregate with no root or no command, a command with no handler, a flow with no flow test, and the like. The `not-designed`, `not-built` and `not-proved` warnings name exactly the obligations coverage lists as lacking each.

Nothing is written to disk.

```ts
import { loadWorkspace, buildReference, renderReference } from '@jaredrob/lathe';

const workspace = await loadWorkspace('/path/to/repo');       // kinds, stages, relations, records, links, problems, coverage
const markdown = renderReference(await buildReference('/path/to/repo'));  // the reference, with the product's own kinds and checks
```

The types are in [src/types.ts](src/types.ts) (`Workspace` and its parts: each record carries its typed columns as `fields` and its part rows as `parts`) and [src/reference.ts](src/reference.ts) (`Reference`).

`lathe serve` and the app's dev server share one HTTP API ([src/server/api.ts](src/server/api.ts)):

| Request | Answer |
| --- | --- |
| `GET /api/spec` | The whole `Workspace`. |
| `GET /api/reference` | The `Reference`: stages, kinds, tables, relations, checks and coverage gaps. |
| `GET /api/history?id=<ID>` | The commits that changed the record's row, newest first (`&commit=<hash>` for one commit's change of the row). |
| `GET /api/events` | Server-sent events: `spec:changed` when a data file changes. |

## Checks

A check is a row of the `check` table: its `name`, `position`, `severity` (`error`, `warning`, or `error_or_warning` when each row says which), a one-sentence `summary`, an `explanation` ending with how to fix what it reports, the `kinds` it concerns, and its `query`. The query lives in the row, and nowhere else: one `SELECT` over the tables that returns `record` (an ID, or NULL) and `message`, plus `severity` when the check's severity is `error_or_warning`, with one row per problem. Write the message as a plain sentence naming the IDs involved. Use `error` when the data is broken and `warning` for work still to do; a rule the schema could enforce belongs in a migration, not a check.

Lathe's checks are in this package's [data/check.jsonl](data/check.jsonl), loaded beside every product's data and never written by a product's writes. A product's own checks are rows of its own `data/check.jsonl` with its `product_id`, and report only on records of that product. A name is unique across both, so a product check cannot take one of Lathe's names. Add one with `lathe add check --name ... --query ...`, or through the app.

A query can read every typed table, the `record_parent`, `link` and `record_group` views (`record_group (id, label)`: a flow step's path, and the `group_name` of every kind that has one, a product's own kinds included), the `record_scope` table, the `meta_*` tables, and what the engine adds for the checks:

| Table or view | Columns |
| --- | --- |
| `file_facts` | `record`, `kind`, `file`, `file_exists`, `contains_id`: each record that names a file |
| `test_level_allowed` | `kind`, `level`: the run by levels each test kind allows |
| `test_run` | `id`, `kind`, `parent_id`, `domain_id` (a pattern rule test's), `level`, `state`, `file`, `level_allowed`, `backed`: every test with its run by |
| `pattern_rule_standing` | `domain`, `id`, `standing`: each rule of each pattern a domain follows, `owed`, `not-applicable` or `waived` there; the app reads it as `Coverage.pattern_rules` |
| `owed_pattern_rules` | `domain`, `id`: each pattern rule a domain owes, as a follower of its pattern, unless not applicable or waived there |
| `obligation_impl`, `obligation_proof` | the technical records that implement each obligation, and the tests that prove it |
| `coverage_owed` | `product`, `domain`, `id`, `kind`: each obligation a domain, or the product outside the domains, owes |
| `coverage_proof` | `product`, `domain`, `id`, `test_id`: the tests that count as an owed obligation's proof where it is owed (a pattern rule's naming the owing domain); the app reads them as `Coverage.proved_by` |
| `coverage_item` | `product`, `domain`, `id`, `kind`, `proof_only`, `designed`, `built`, `proved`, `has_not_automated`: each owed obligation, judged |
| `coverage_count`, `coverage_gap`, `coverage_tests` | the counts per scope and obligation kind, every gap (`missing` is designed, built, proved or a gap rule's name, with its `message`) and the tests by state |

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

In this repo the CLI runs from source on Node 26's built-in TypeScript support; the package ships compiled JavaScript, because Node does not run TypeScript from `node_modules`. The engine's tests build their products with the store's command layer ([test/helpers.ts](test/helpers.ts)): `complete()` breaks no check and leaves no gap, and each test changes one thing; `sparse()` falls short of every minimum coverage reports.

## Build the package

```sh
npm --prefix lathe run build   # compiles src/ and bin/ to dist/, regenerates REFERENCE.md, and builds the web app into dist/app
cd lathe && npm pack           # writes jaredrob-lathe-<version>.tgz
```
