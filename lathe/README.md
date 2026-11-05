# Lathe

Lathe keeps a product's lifecycle (discovery, domain model, use cases, interface design, technical specification, test plan) as typed data in the product's own repo, checks it, traces it to the code and tests, and serves a web app to browse and edit it. Every table, column, relation and check is listed in [REFERENCE.md](REFERENCE.md), generated from the schema and the check rows.

## Use it in a product repo

```sh
npm install --save-dev /path/to/jaredrob-lathe-1.0.0.tgz   # until it is published
npx lathe init --name "Tool Library" --prefix TL
npx lathe domain add-domain --id TL-LEND --title Lending --product_id TL --position 1 --subdomain_type core \
  --description "Lending tools to members and taking them back."
npx lathe check
npx lathe serve            # http://127.0.0.1:5330
npx lathe serve --network  # also on the local network, read only for other devices
```

## The data model

- **One concrete model.** Kinds are drawn from domain-driven design, CQRS and event storming, in six stages: discovery (the business outcomes a product exists to achieve, each measurable, which its capabilities serve, and the journeys that reach them: use cases and handoffs in order, from a trigger to a result), the domain model (aggregates, entities, value objects, constraints, invariants, specifications, events, commands, read models, queries, policies, domain services, terms), use cases (capabilities, use cases, UC requirements, each use case's flow and its steps, patterns), interface design (interfaces, views, endpoints, integrations, view and API requirements), the technical specification (one technical kind implements each design kind: a command's command handler, an entity's data model and table, and so on) and the test plan (one test kind per thing tested, journeys included, each with its run by: level, state, file, size and markers, and the test data sets tests start from). Clean architecture's "use case" is what Lathe calls a command handler.
- **A table per kind.** Every kind of record has a table of its own, with typed columns: a UC requirement's one-sentence `statement`, a test's run by (`level`, `state`, `file` or `manual_reason`).
- **One parent, as a foreign key.** A UC requirement names its use case in `use_case_id`, an entity its aggregate in `aggregate_id`; an endpoint sits under its command or its query. Value objects, specifications, views, integrations and UI components have no owner: they exist because other records use them, and take their product (or a specification its domain) from their ID.
- **Parts are rows of their own.** An entity's fields are `entity_field` rows, a use case's actors are `use_case_actor` rows, a table's keys are `table_key` rows, a pattern's settings are `pattern_setting` rows and a follower's answers are `setting_value` rows. They go with their record when it is removed.
- **A link is a row of its relation's table.** `fulfills` holds (`source_id`, `target_id`) pairs, a flow step and the UC requirement it fulfills. Where a relation may link several kinds, an end points at a supertype table such as `operation` (every command and query), so every link has a real foreign key.
- **IDs are unique across every kind.** The `record_id` registry holds every ID with its kind, so a bare ID resolves.
- **The schema is the meta-model.** It is the numbered SQL migrations in [schema/](schema/), applied in order to DuckDB, with a comment on every table and column. A new column comes by a new migration; `npm --prefix lathe run schema` then regenerates the row types in [src/platform/data/tables.ts](src/platform/data/tables.ts).
- **A product may add its own kinds and relations** as `product_kind`, `product_kind_field` and `product_relation` rows. Lathe generates a table for each, with the same keys and rules as its own kinds. Lathe's own kinds cannot be widened; that is a migration.

What the schema enforces is never a check: data with a missing parent, a link to nothing, a value outside its enum, a duplicate ID or a link across products cannot be saved.

## The data folder

The source of truth is `data/<table>.jsonl` at the product repo's root: one file per stored table with rows, one JSON object per line, rows sorted by key, columns in the table's order, columns without a value left out, UTF-8 with a trailing newline. A change to a row is a one-line diff, and git is the history: `git log` and `git blame` show what changed, when, and whether the Owner or an Agent made it. The database is built in memory on each load and never committed.

`lathe.config.json`, at the root, is written by `lathe init`:

```json
{ "schema": 4, "data": "data" }
```

| Key | Default | Meaning |
| --- | --- | --- |
| `schema` | `1` | The schema version the data is for (see [Upgrading](#upgrading)). |
| `data` | `data` | The folder of data files. |
| `tests` | `["**/*.test.{ts,tsx,js,mjs}", "**/*.spec.{ts,tsx,js}"]` | Globs of the test files, from the root, whose test cases `test-case-unnamed` reads, with every file a test names; node_modules, dist, dot-folders and a folder with its own `lathe.config.json` are never read. |
| `source` | code in the common languages (`**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,vue,svelte,py,rb,go,rs,java,kt,swift,cs,php}`) | Globs of the source files, from the root. Each must be named by a technical record, directly, as one of its helper files, or through a folder one names, or coverage lists it as a `code-file-untraced` gap. Tests (the `tests` globs, and files in `test`, `tests`, `__tests__`, `__mocks__` or `fixtures` folders), configs (`*.config.*`, `.*rc` files, `*.d.ts`), generated files (`@generated`, or "generated" and "do not edit", in the first five lines), `node_modules`, build output (`dist`, `build`, `out`, `coverage`), dot-folders and another product's folder are left out whatever the globs. |
| `routers` | none | Glob patterns, from the root, of the files besides the endpoint handlers' that declare the routes the product serves (a server's entry, a client's route table). `lathe check` reads them and the handlers' files for served routes, and lists each one no endpoint or view has as a `route-without-record` gap. |
| `packages` | the root and each folder directly under it with a `package.json`, except another product's | The package folders whose `package.json` lists the product's packages. Every package one lists (dependencies and dev, optional and peer dependencies alike) is named by a technical record's `package_use` row, or coverage reports a `package-not-accounted-for` gap on the product; a record naming a package no manifest lists is a `package-not-in-manifest` error. A folder inside another product's folder is refused. |
| `products` | none | The folders, from the root, of the other products this repo shows as a workspace, such as `["examples/tool-library"]`: each with its own `lathe.config.json` and data, loaded beside the repo's own product as its own space, with its own config, schema version, checks, tracing and coverage. `lathe check` checks each, and `lathe serve`, the app's dev server and the desktop app show each, writing every change to its own product's folder. Only the workspace lists products; a listed folder that is the root, is listed twice or has no config, and one product ID in two folders, are refused. |

A folder with its own `lathe.config.json` is always another product's: the repo's tests, source files, router files and default package folders never include a file in it, whether the repo lists it under `products` or not.

Any other key, or a file that is not one JSON object, is refused when the config is read. A product's settings are data too: `product_setting.max_children` (15 when the product has no row) is the most children of one kind a record has before the `too-many-children` warning. `product_setting.max_entities_per_aggregate` (7 when the product has no row) is the most entities an aggregate has before the `aggregate-too-large` warning; a settings row gives both. `product_setting.strict_check` makes the product's check strict, so any warning of the product fails it as a `strict-check` error; while zero cannot be reached yet, `product_setting.accepted_warnings` records how many it accepts, a deviation the check holds exactly: it fails above the count and below it, until the count is lowered, so the count only moves down. Set both with `lathe product-setting set-strict-check`, which refuses a count above the warnings the product has now; not strict by default.

## Changing the data

Every change is one command of the aggregate it changes, such as Add a flow step on the Use case aggregate: it loads the aggregate through its repository, holds it to the aggregate's rules, and saves it in one transaction (every key, rule and validation query), and only then rewrites the lines it changed. A refusal gives every reason, with the rule it broke, and changes nothing. Each aggregate reads through its own queries too, such as Get a use case. Nobody edits the files by hand.

A write through the CLI or an MCP tool runs the checks before and after it, and its answer lists the problems it introduced (`introduced`: each warning, and any `strict-check` error, the check before it did not report, for every product, strict or not), so the Agent fixes them at once. The checks run once per write, after it: the problems of each run are kept by the key of the data and config they ran on (in the process's memory, and in the cache folder, `LATHE_CACHE_DIR`, for the next process), so the run before a write is the one kept for the data as it was. A command that reads the checks' problems, such as `set-strict-check`, is given the ones before the write.

- **The CLI.** `lathe <aggregate> <command>`, such as `lathe use-case add-flow-step`, with flags and help from the command's fields (`lathe use-case --help`, `lathe use-case add-flow-step --help`); its queries the same way, such as `lathe use-case get-use-case --id TL-LEND-UC01`. `--json` prints the result as JSON. A command takes its fields as JSON instead of flags with `--json -` (stdin) or `--json <file>`: the arguments of its MCP tool. Text keeps its quotes, newlines and backticks, the validation and refusals are the flags', and JSON given with field flags as well is bad usage.
- **The app.** Each record's page has its aggregate's own editor, which sends its aggregate's commands to `POST /api/<aggregate>/<command>`.
- **The Claude Code plugin.** Its MCP server (`lathe mcp`) has one tool per command and query, named `<aggregate>_<command>`, such as `use_case_add_flow_step`, and the `check` tool. The package ships the plugin in `dist/plugin`; its read tools are marked `readOnlyHint`, and with `LATHE_VIEW_ONLY=1` (the desktop chat's View only mode) the server lists only the queries and the check, and refuses every command.
- **Code.** `runCommand` runs one of `ALL_COMMANDS` on an open store:

```ts
import { ALL_COMMANDS, openStore, runCommand } from '@jaredrob/lathe';

const addRequirement = ALL_COMMANDS.find((c) => c.slice.name === 'use-case' && c.name === 'add-uc-requirement')!;
const store = await openStore('/path/to/repo');           // loads data/*.jsonl, or throws a StoreError naming file, line and rule
await runCommand(store, addRequirement, { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
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

A driver that cannot start, because this checkout's `lathe` is not installed, stops the merge with one message: the missing package, that the file was not merged and holds only our side, and the commands to install and to merge it again (`git checkout -m <file>`).

## The command

`lathe <command> [options]`. Every command takes `--root <dir>`, the product repo (default: the current folder). `lathe help` prints the usage, every aggregate's commands included.

| Command | What it does |
| --- | --- |
| `init --name <name> --prefix <P>` | Writes `lathe.config.json` (if there is none) with this Lathe's schema version, and adds the product to `data/product.jsonl` with Add a product. Both options are required; the prefix is capital letters and digits, starting with a letter. It stops if that product already exists. |
| `check [--json]` | Loads the data and checks it: the product's, then each product `products` lists, each from its own folder and reported on its own, with the counts of them all at the end. For each it prints the errors, then the warnings, then the coverage: for each domain, and for the product outside the domains, one line per obligation kind (designed, built and proved out of the total, and how many wait on a test not automated yet, with each gap), a line of test counts, and the records short of a minimum. Exits 1 on any error, data the store refuses included; warnings alone do not fail it unless the product's check is strict (`product_setting.strict_check`), when any warning beyond those it accepts is a `strict-check` error and the count line says the product is strict. `--json` prints `{ products: [{ root, strictness, workspace }] }` instead, each product's folder, the strictness of each product it holds (strict, accepted, warnings and why it fails) and its whole `Workspace`. |
| `upgrade` | Moves the data forward to this Lathe's schema version (see [Upgrading](#upgrading)). |
| `serve [--port <n>] [--network]` | Serves the web app and its API at `http://127.0.0.1:<port>` (default 5330), for the product and each product `products` lists. Open pages reload when any of their data changes. `--network` also listens on the local network and prints an `http://<address>:<port>` line for each of this machine's network addresses: another device on the network, such as a phone on the same Wi-Fi, opens one and reads; only this machine changes the spec. |
| `merge-data <base> <ours> <theirs> <path>` | Git's merge driver for the data files (see [The merge driver](#the-merge-driver)). |
| `mcp` | Serves every aggregate's commands and queries, and the check, as MCP tools over stdio, for the Claude Code plugin. |
| `<aggregate> <command>` | An aggregate's command or query, such as `use-case add-flow-step` (see [Changing the data](#changing-the-data)). |
| `app focus`, `app open <id> [--stage graph\|erd\|trace]` | The MCP tools `app_focus` and `app_open` from a shell: what the Reader is looking at in the desktop app's window, and opening a record there. They work in the desktop app's chat, which gives its Claude Code the window's bridge (`LATHE_APP_BRIDGE`, `LATHE_APP_TOKEN`); with no window connected they are refused and exit 1. `--json` prints the result as JSON. |

A usage mistake (a missing option, an unknown command, a bad port) exits 2.

## Upgrading

Lathe's schema has a version: one whole number in [schema/version.json](schema/version.json), 1 for the first versioned schema, 2 since each flow goes through an interface and a test runs at one of five levels (converter `upgrades/1-to-2.ts`), 3 since each check names its domain (`2-to-3.ts`), 4 since every kind is essential or accidental complexity and a use case has one flow whatever the interface (`3-to-4.ts`), 5 since journeys (`4-to-5.ts`), 6 since each domain has a position (`5-to-6.ts`), and 7 since flows belong to the use cases stage and interaction design is interface design, its key `interface-design` (`6-to-7.ts`). A product's `lathe.config.json` names the version its data is for (none is 1). Every load (`lathe check`, the aggregates' commands and queries, `lathe serve`, the MCP tools, `loadWorkspace` and `openStore`) stops on data for another version, with one message and nothing read: data for an older schema says to run `npx lathe upgrade`; data for a newer one says the product needs a newer Lathe.

**Versions.** The package follows semantic versioning, and its major version tracks the schema: a breaking schema change (a table, column or rule that existing data may not pass, such as a renamed or removed column or a new required one) raises the schema version by one, adds a converter, and raises the major version. A new kind, an optional column or a new check is a minor version; a fix is a patch. Two releases with the same major version read the same data.

**Upgrading a product.** Update `@jaredrob/lathe` in the product repo, commit, then:

```sh
npx lathe upgrade
```

It runs each converter in order from the product's schema version to this Lathe's, prints what each changed, then a list of what it could not convert, for you to finish by hand (nothing is silently dropped), and raises `schema` in `lathe.config.json`. It refuses a git working tree with changes, or a product not under git, so the whole upgrade is one commit to review with `git diff`. If the converted data does not load under the new schema, it stops before raising the version and lists the store's refusals as the to-dos; `git checkout -- .` undoes it. The upgrade goes one way: nothing old is kept, and no Lathe reads the old form afterwards.

**From schema 2 or 3 to 4.** Run `npx lathe upgrade` once; it runs `2-to-3` and `3-to-4` in turn, so a product on schema 2 goes straight to 4, in one commit.

- *By itself:* each check names its domain (from the `check_row` records, which go); each product kind says its complexity, from its stage (technical kinds accidental, test kinds as their parent, the rest essential); each standard becomes an engineering standard; each interface becomes internal; each product setting gets an empty list of technology words; the pairs of `provided_by`, `fills` and `generates` a kind now has are dropped from the product's own declarations; and each use case's flows, one per interface, merge into one flow with the union of their steps (equal steps become one, a step only one interface had becomes that interface's variant), with each interface offering the use cases it had a flow of, each view presenting what its steps invoked, one acceptance test kept per use case, and the flow, step and test IDs renamed wherever they are named.
- *By hand (the to-do list):* mark each standard that says what the product's people need (exact money, auditability, a latency budget) a quality; mark each interface that outsiders build on public, which makes its API requirements essential; list the roles that use each interface; make each variant step a step of every interface that does it, and give a step that lost its view a query to invoke; have each interface follow its pattern and prove its rules once per domain, replacing the flow tests that were dropped; rename the flow, step and test IDs your code names; and account for every technical record, now accidental complexity, as derived (a tooling record generates it), provided (`provided_by` a platform, library or generator) or a fill at a pattern's slot. `lathe check` lists what is left as warnings; the plugin's skills explain how to settle each.

If the product fails to load afterwards, the upgrade stops before raising the version and the store's refusals are the to-dos; `git checkout -- .` undoes it.

**Writing a converter.** A breaking schema change comes with `upgrades/<from>-to-<to>.ts`, moving the data forward exactly one version (`1-to-2.ts`). Its default export rewrites the raw rows of the data files:

```ts
import type { Converter } from '../src/index.ts';

export default {
  // What the new schema cannot load as it is: a renamed or removed column, a moved table, a required text.
  files(data, notes) {
    data.write('product', data.read('product').map(({ notes: delivery, ...row }) => ({ ...row, delivery })));
    notes.changed('product.notes is now product.delivery');
    for (const row of data.read('product')) if (!row.delivery) notes.todo(`${row.id}: write how it is delivered`);
  },
} satisfies Converter;
```

Every converter runs in order, then the data must load under the new schema, with every aggregate's rules, before the version is raised: the converters bring the data to a shape this Lathe loads. A table a converter rewrites takes the store's own order and line format. `notes.changed` lines are the summary; `notes.todo` lines are the to-do list. Test each converter on a copy of a real product before release; [test/cli/upgrade.test.ts](test/cli/upgrade.test.ts) shows the whole path with a test converter.

## The engine

`loadWorkspace(root)`:

1. Opens the store: reads `data/*.jsonl`, and Lathe's own `data/check.jsonl` from this package beside it, into the typed tables, with every key, rule and validation query. Data the store refuses becomes `data-refused` errors naming the file, line and rule, and nothing else is checked until it is fixed.
2. Scans the code: the `file` of every technical record and test (and of a product's own kind with a file field), and each helper file of a technical record (`helper_file`), into `file_facts`: does it exist (a technical record's file may be a folder; a helper file may not), and does it name the record's own ID as a whole ID.
   It also reads the test cases of the product's test files (the `tests` globs of `lathe.config.json` and every file a test names) into `test_case` and `test_case_id`, as text: each call of `it` or `test` (with its modifiers and `each` forms) whose name is a string or template literal, under the names of the `describe` calls around it, and the IDs those names and `each` rows name. Strings and comments are skipped; a name that is not a literal, and a test made by a helper function, are not recognized ([src/trace/test-cases.ts](src/trace/test-cases.ts)).
3. Works out coverage (see below) and runs every check row: Lathe's in position order, then each product's. A product's check reports only on records of its product.
4. Reads coverage per domain, and per product outside the domains.

**Coverage.** Every obligation (constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule, standard rule, and a product's own obligation kinds) is counted as:

- **designed:** a UC requirement once a step of its use case's flow fulfills it, a standard rule once a technical record meets it, a product's own obligation once a design or build link targets it; the others by construction (a pattern rule wherever a following domain owes it);
- **built:** every one of the specific technical records that implement it names a file that exists, and so does each helper file it names, and there is at least one, never other code near it: a constraint's value type, an invariant's rule, a specification's predicate, a policy's event handler and the adapter of each integration it exchanges with, a domain service's service, a UC requirement's command or query handlers (of what its fulfilling steps invoke) with the predicates and services of what they check, select by or call, and the adapter of each integration its steps exchange with, a view requirement's UI components that build it (`builds`), an API requirement's endpoint handler, a standard rule's meeting records, and a product's own obligation's design and build link sources. A pattern rule asks for proof only;
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
| `GET /api/<slice>/<query>?<field>=<value>` | One query's own answer, such as `/api/use-case/get-use-case?id=<ID>`. Each aggregate has its reads (get it whole, list within its parent, next ID), and each stage of the app its own: the meta model (`/api/meta-model/get-meta-model`), a product's record summaries, folder tree, ERD, record changes since a baseline (`since=commit\|branch\|<hash>`), problems, coverage, traces and one record's trace. |
| `POST /api/<aggregate>/<command>` | One aggregate command with its input; the changed rows, or the refusal with every reason. |
| `GET /api/reference` | The `Reference`: stages, kinds, tables, relations, checks and coverage gaps. |
| `GET /api/history?id=<ID>` | The commits that changed the record's row, newest first (`&commit=<hash>` for one commit's change of the row). |
| `GET /api/events` | Server-sent events: `spec:changed` when a data file changes. |

Every write is refused with 403 when it comes from another site's page, or from any address but this machine's loopback (`127.0.0.1`, `::1`): a server opened to the network has no sign-in, so other devices read only. Every API answer to another device carries `x-lathe-access: read-only`, and the app then shows "Read only on this device" and no editing actions.

## Checks

A check is a row of the `check` table: its `name`, `position`, `severity` (`error`, `warning`, or `error_or_warning` when each row says which), a one-sentence `summary`, an `explanation` ending with how to fix what it reports, the `kinds` it concerns, and its `query`. The query lives in the row, and nowhere else: one `SELECT` over the tables that returns `record` (an ID, or NULL) and `message`, plus `severity` when the check's severity is `error_or_warning`, with one row per problem. Write the message as a plain sentence naming the IDs involved. Use `error` when the data is broken and `warning` for work still to do; a rule the schema could enforce belongs in a migration, not a check.

Lathe's checks are in this package's [data/check.jsonl](data/check.jsonl), loaded beside every product's data and never written by a product's writes. A product's own checks are rows of its own `data/check.jsonl` with its `product_id`, and report only on records of that product. A name is unique across both, so a product check cannot take one of Lathe's names. Add one with `lathe add check --name ... --query ...`, or through the app.

A query can read every typed table, the `record_parent`, `link` and `record_group` views (`record_group (id, label)`: a flow step's path, and the `group_name` of every kind that has one, a product's own kinds included), the `record_scope` table, the `meta_*` tables, and what the engine adds for the checks:

| Table or view | Columns |
| --- | --- |
| `file_facts` | `record`, `kind`, `file`, `path` (the file from the root, with forward slashes; NULL outside it), `file_exists`, `contains_id`, `helper`: each record that names a file, and one more row for each helper file of a technical record (`helper` true) |
| `test_case` | `file`, `position`, `line`, `name`: each test case in the product's test files, its name after its describes' names |
| `test_case_id` | `file`, `position`, `id`: each ID a test case, its describes or its `each` rows name |
| `test_level_allowed` | `kind`, `level`: the run by levels each test kind allows |
| `test_run` | `id`, `kind`, `parent_id`, `domain_id` (a pattern rule test's), `level`, `state`, `file`, `level_allowed`, `backed`: every test with its run by |
| `owed_pattern_rules` | `domain`, `id`: each pattern rule a domain owes: every rule of each pattern it follows, itself or through a use case; the app reads it as `Coverage.pattern_rules` |
| `obligation_impl`, `obligation_proof` | the technical records that implement each obligation, and the tests that prove it |
| `coverage_owed` | `product`, `domain`, `id`, `kind`: each obligation a domain, or the product outside the domains, owes |
| `coverage_proof` | `product`, `domain`, `id`, `test_id`: the tests that count as an owed obligation's proof where it is owed (a pattern rule's naming the owing domain); the app reads them as `Coverage.proved_by` |
| `coverage_item` | `product`, `domain`, `id`, `kind`, `proof_only`, `designed`, `built`, `proved`, `has_not_automated`: each owed obligation, judged |
| `coverage_count`, `coverage_gap`, `coverage_tests` | the counts per scope and obligation kind, every gap (`missing` is designed, built, proved or a gap rule's name, with its `message`) and the tests by state |

If a check's query fails to run, the engine reports that as an error under the check's name rather than crashing. A query is one `SELECT` that only reads, as DuckDB's own parser reads it: a row whose query DuckDB reads as two statements, as one that is not a `SELECT`, or as a `SELECT` with an `INSERT`, `UPDATE`, `DELETE` or `COPY` inside it, is refused when it is written or loaded, whatever quoting hides the `;`. Each check runs in a transaction that is rolled back. And it runs in a sealed database: before a load's first query of the data, the engine turns off DuckDB's file, network and extension access, its temporary folder and its settings, so a query that reads or writes a file or a URL (`read_text`, `read_csv`, `glob`, `COPY`, `ATTACH`), loads an extension or changes a setting reports that it could not run. After adding or changing one of Lathe's checks, run `npm --prefix lathe run reference` to regenerate REFERENCE.md; a test fails when it is out of date.

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
npm --prefix lathe run build   # compiles src/ and bin/ to dist/, regenerates REFERENCE.md, builds the web app into dist/app and copies the Claude Code plugin into dist/plugin
cd lathe && npm pack           # writes jaredrob-lathe-<version>.tgz
```
