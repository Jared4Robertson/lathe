---
name: write-the-technical-spec
description: Write or change a Lathe product's technical specification - the one technical record that implements each design record (repository, data model, table and its keys, value type, predicate, event type and its delivery, projection, command, query and event handlers, service, endpoint handler, adapter, UI component), the files that hold them, and the product's standards. Use when recording where code lives and how it is stored, when adding a table, key or index, when deciding how an event is delivered, or when writing an engineering rule the code follows, in a repo with lathe.config.json.
---

# Write the technical specification

The technical specification says which code implements each design record, and how the domain's data is stored. One concrete kind implements each design kind, and each technical record names the file that holds it. An obligation is **built** once every one of the specific technical records that implement it names a file that exists, and there is at least one: an invariant through its rule, a view requirement through the UI components that build it, a UC requirement through the handlers of what its fulfilling steps invoke (with the predicates and services of what they check or call) and the adapters of the integrations they exchange with. No other code near it counts: not a data model, a unique key, or a UI component that only renders the view. A record that names a file not written yet keeps it unbuilt, which is what you want until the code is there. Write it after the domain model and the interaction design it implements.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files. Every kind belongs to one aggregate of Lathe's own model, and each aggregate has its own tools, named for the aggregate and the command: `<aggregate>_add_<kind>`, `<aggregate>_change_<kind>` and `<aggregate>_remove_<kind>` for each kind it holds, a move where a record really moves (a table to another entity or read model); and its reads, `<aggregate>_get_<aggregate>` (it whole, by the ID of any record in it), `<aggregate>_list_<aggregate>s` (those under a parent) and `<aggregate>_next_id`. `check` runs the checks. Each command checks its aggregate's rules and is refused, with every reason, when it breaks them; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- A technical record sits in the aggregate of the design record it implements: a command handler in the Command aggregate, a data model in the Aggregate aggregate, a value type in the Value object aggregate. Its parts and the links it starts are fields of its own add and change: the standard rules it `meets`, the `packages` it uses, a repository's `persists`, a table's `keys`. On a change a list replaces the list. There are no tools that link or unlink.
- Each tool's input schema lists its fields, with each column's type and meaning. In a shell the same commands are `lathe <aggregate> <command> --<field> <value>` (`lathe command add-command-handler --help` prints its fields; `npx lathe` in a product repo, `npm --prefix lathe run lathe -- <aggregate> <command> --root ..` in the Lathe repo), or the tool's own JSON with `--json -` (stdin) or `--json <file>`.
- Take each technical record's ID from its aggregate's `<aggregate>_next_id`, with the kind and the design record it implements as `parent`: it is that record's ID and a suffix (`TL-LEND-CMD05-H`), one per design record. A UI component has no owner: give the product.

## Before you write

1. Read the design record you implement whole with its aggregate's get tool (`command_get_command`, `aggregate_get_aggregate`, ...), to see whether it has its technical record already.
2. Read the code: a technical record names a real unit in a real file, not a wish.
3. Every source file must be named by a technical record, directly or through a folder a record names; coverage lists each one that is not as a `code-file-untraced` gap. Name the record the file implements, add the missing record when the file implements something real, or delete the file when it is dead. Tests, configs, generated files and build output are left out; `source` in `lathe.config.json` says which files are source.

## The kinds

| Technical kind | Implements (its parent) | ID | Written with |
| --- | --- | --- | --- |
| `repository` | a domain: loads and saves the one aggregate it `persists`, whole | `<domain>-REPO<nn>` | `domain_add_repository` |
| `data_model` | an entity: its code, behavior and mapping to its table | `<entity>-DM` | `aggregate_add_data_model` |
| `table` | an entity or a read model: its storage | `<entity or read model>-TB` | `table_add_table`, `table_move_table` |
| `value_type` | a value object, and so its constraints | `<value object>-VT` | `value_object_add_value_type` |
| `rule` | an invariant: the code that enforces it, titled by the name its refusal carries | `<invariant>-RL` | `aggregate_add_rule` |
| `predicate` | a specification | `<specification>-PR` | `specification_add_predicate` |
| `event_type` | a domain event: its shape, a contract when published | `<domain event>-ET` | `domain_event_add_event_type` |
| `projection` | a read model: fills its table and keeps it current | `<read model>-PJ` | `read_model_add_projection` |
| `command_handler` | a command | `<command>-H` | `command_add_command_handler` |
| `query_handler` | a query | `<query>-H` | `read_model_add_query_handler` |
| `event_handler` | a policy | `<policy>-H` | `command_add_event_handler` |
| `service` | a domain service | `<domain service>-SV` | `domain_add_service` |
| `endpoint_handler` | an endpoint | `<endpoint>-H` | `endpoint_add_endpoint_handler` |
| `adapter` | an integration | `<integration>-AD` | `integration_add_adapter` |
| `ui_component` | none: it `renders` the views it is used in, and `builds` the view requirements its code does | `<P>-UI<nn>` | `ui_component_add_ui_component` |
| `entry_point` | a domain: a file that starts the product | `<domain>-ENTRY<nn>` | `entry_point_add_entry_point` |
| `tooling` | a domain: a tool's configuration, such as the type checker's or the test runner's | `<domain>-TOOL<nn>` | `tooling_add_tooling` |

Each has its change and remove tools beside its add.

A repository sits under its domain and names the one aggregate it `persists`: one repository per aggregate, and one aggregate per repository (a second either way is refused). A repository that persists none is an error (`repository-persists-nothing`). Write one record per repository in the code, named for its class, such as `LoanRepository`, with its methods in its description. Code that loads and saves several aggregates the same way, such as a generic store over uniform rows, is not one repository for them all: split it into one repository per aggregate, each loading and saving only its own aggregate's tables. A repository shared by several domains sits under the domain that holds what they share, such as a Platform domain.

Each has `file` (from the product root; it may not exist yet, and several records may share one file). Name the unit in its `title`, such as `borrowTool`.

Every kind's text is required or absent (`LA-STD-MODELING-R10`). The application layer and infrastructure choose how the work is done, which the design leaves open, so a repository, projection, command, query, event or endpoint handler and adapter must have a `description` saying how it works, in a sentence or two: where and in what form a repository keeps its aggregate, when a projection is rebuilt, a handler's transaction and the order of its checks, where an event handler hears its event, how an adapter calls its outside system. Never restate the design record it implements, and never only list code names. A data model, value type, predicate, event type and service transcribe their domain record, and a table's columns follow from its fields, so they have no description: the domain record says what it is, and the title and file say where. A UI component must have a `description`: what it renders and where it sits.

## Naming

A technical record is bound to code, so its `title` is the identifier exactly as the code writes it, with no spaces: `LoanRow`, `buildReference`, `loans`. It is unique within its kind and product and has no trailing period; a duplicate, a trailing period or a title with whitespace is refused. Explain the unit in its `description` where its kind has one, never in the title (`Loans (repository)` is refused; `LoanRepository` is not). This holds for every technical kind but the UI component, named for what it shows (Record card, see `design-interactions`), and for an entry point, tooling and a product's own code-bound kinds, such as an IPC channel or a plugin hook.

| Kind | Title | Good |
| --- | --- | --- |
| data model, projection, handlers, service, repository, adapter, predicate, value type, table, event type | the identifier in code | `Loan`, `ToolReturned`, `loans` |
| standard, standard rule | a singular noun phrase; a sentence that is true when the rule holds | Code; Errors carry a code and a sentence |
| a CLI command or CLI query | the invocation | lathe use-case add-flow |
| a check row | the kebab-case name of the mistake it finds | event-tense |

A check row title not in kebab case is refused.

What follows from the tree is not stored: a command is carried out by its handler and its aggregate root's data model, and a handler loads and saves its aggregate only through the repository that persists it. Name nothing for these; only a repository names the aggregate it persists.

## Domain layer and application layer

- **Domain layer:** data models, value types, predicates, event types and services. A service never uses a repository or an outside system: its inputs are passed in, and it returns a value or a decision.
- **Application layer:** command handlers, query handlers and event handlers, what DDD calls application services. Only they, each through its own aggregate's repository, and projections, read or write storage. A command handler owns its transaction; a projection writes only its own read model's table. Several handlers may share one file, such as one service class per aggregate, but each command and query still has its own handler record.
- Clean architecture's "use case" or "interactor" is what Lathe calls a command handler. A Lathe use case is the actor's goal, one level up.

## Tables and keys

- Every stored thing names its storage. An entity has at most one table, and a read model one, even when it is not in a database. A child entity with `in_root_table: true` has none: its fields are columns of its root's table.
- A table's columns follow from its entity's or read model's fields, a value object's fields flattened into columns, so a table stores only `name`, `storage` and its keys. An entity's table holds its rows, the source of truth: `storage: "table"`, normalized, or, when it is not in a database, `"browser storage"` (local or session storage, or the browser's history; `name` is its key there, such as `lathe:tabs`), `"file"` (a file of its own the program reads and writes whole, such as `window-state.json`) or `"in memory"` (kept only while the program runs), with `file` naming the code that reads and writes it. Never a `view` or `materialized view`: those are derived. A read model's is a projection that can be rebuilt: usually a `view` over its domain's entity tables, whose query is its projection, or a `table` its projection fills from events (such as another domain's published events), or a `materialized view`, or `in memory` when its projection computes it on each load and nothing keeps it, or `browser storage`.
- Keys are asked only of a `table`, `view` or `materialized view`: one in `browser storage`, a `file` or `in memory` has none, and no foreign key points at one.
- Its keys are `table_key` rows, in `position` order: one `primary`; a `unique` key names the `invariant_id` it enforces, with a `condition` for a partial key; a `foreign` key names its `target_table_id`, a table of the same domain (a reference to another domain's aggregate stays a plain ID); and `index`. `columns` names the columns by their names in the database.
- A `table` names the file that creates it (a migration, a SQL schema, or the code that runs its CREATE TABLE), and a `view` or `materialized view` the file that defines it. `lathe check` reads that file as text and warns (`table-schema-mismatch`) of the table's name, a column or a primary, unique or foreign key the file does not define. A column is a field's `column_name`, else its name in lower case with underscores (Joined at is `joined_at`), so give `column_name` whenever the code names it otherwise. A `table` with no file is a coverage gap (`table-without-file`).

## Event types and the outbox

An event type's `delivery` says how its event reaches what hears it: `in process`, after the transaction commits, or `outbox`, saved in the same transaction as its aggregate and delivered reliably afterwards. **The outbox is the standard for an event a policy hears:** it is delivered by outbox, since a lost reaction is a lost change. The check warns about every such event whose event type is not. An event that only keeps read models current (`fed_by`), where those read models are rebuilt from the data on every load, may be delivered in process, published or not.

## Standards

A product's engineering rules for its code, such as logging, error handling or naming, live in **standards** beside the patterns: a `standard` under the product (`<P>-STD-<NAME>`, such as `TL-STD-CODE`) with its `standard_rule` records (`<standard>-R<nn>`), one rule each in `statement`. A technical record that follows a rule says so with a `meets` link to it, which shows where the rule is applied and designs it. A standard rule is proved by its standard rule tests (`plan-tests`), such as a scan of the code for what the rule forbids; write only rules the code really follows. A standard and its rules are written with `standard_add_standard` and `standard_add_standard_rule`, and a technical record names the rules it meets in its own `meets`.

## Kinds of code Lathe has no kind for

The Tool Library's `src/server.ts` is an entry point and its tool configs are tooling records, both Lathe kinds under the domain. Where no technical kind fits at all, such as a migration or a graph layout, the product declares a kind of its own in the technical-specification stage (see `extend-the-meta-model`).

## Packages

Every package the product's `package.json` files list, dev dependencies included, is accounted for by the technical record that uses it, in that record's `packages`, such as `"packages": ["nodemailer"]` on the adapter that sends mail. A package no record names is a `package-not-accounted-for` gap on the product; a record that names a package no manifest lists is a `package-not-in-manifest` error, so drop it from the record's `packages` when the dependency goes. Only a technical record names one: a tool the product is checked or tested with (the type checker, the test runner) is named on a tooling record, as the Tool Library's `tsconfig.json` and `vitest.config.ts` are. The package folders are those `lathe.config.json`'s `packages` lists, or else the root and each folder directly under it with a `package.json`.

## Example: the Tool Library

The handler of Borrow a tool, the repository and data model of the Loan, and the event type of Tool returned with the event handler of the policy that hears it. Every Tool Library event goes by outbox: one path for all six keeps the code plain, and an event a later policy hears needs no change.

```
command_add_command_handler { "id": "TL-LEND-CMD05-H", "title": "borrowTool", "command_id": "TL-LEND-CMD05",
       "file": "src/loan-commands.ts",
       "description": "Checks the IDs, then in one transaction loads the member, the tool and their active loans through their repositories, and saves the new loan through LoanRepository.add. It saves LoanOpened to the outbox in that transaction and runs the relay once it commits." }
domain_add_repository { "id": "TL-LEND-REPO03", "title": "LoanRepository", "domain_id": "TL-LEND", "file": "src/loan-repository.ts",
       "description": "Keeps each loan as a row of the loans table: add, get, activeForMember, activeForTool and save, each inside its command handler's transaction.",
       "persists": "TL-LEND-A3" }
aggregate_add_data_model { "id": "TL-LEND-EN04-DM", "title": "Loan", "entity_id": "TL-LEND-EN04", "file": "src/loan.ts" }
aggregate_add_rule { "id": "TL-LEND-INV03-RL", "title": "tool_on_loan", "invariant_id": "TL-LEND-INV03", "file": "src/loan.ts" }
domain_event_add_event_type { "id": "TL-LEND-EV06-ET", "title": "ToolReturned", "domain_event_id": "TL-LEND-EV06", "delivery": "outbox",
       "file": "src/events.ts" }
command_add_event_handler { "id": "TL-LEND-PO01-H", "title": "reportDamageOnReturn", "policy_id": "TL-LEND-PO01",
       "file": "src/event-handlers.ts",
       "description": "Subscribed to ToolReturned on the outbox; for a return needing repair it invokes Report damage's handler, in its own transaction." }
```

The loans table, with its primary key, a foreign key to the members table, and the partial unique key that backs up one active loan per tool (the invariant is built by its rule, `tool_on_loan`, not by the key):

```
table_add_table { "id": "TL-LEND-EN04-TB", "title": "loans", "entity_id": "TL-LEND-EN04", "name": "loans", "storage": "table", "file": "src/database.ts",
       "keys": [ { "type": "primary", "columns": ["id"] },
                 { "type": "foreign", "columns": ["member_id"], "target_table_id": "TL-LEND-EN01-TB" },
                 { "type": "unique", "columns": ["tool_id"], "name": "loans_one_active_per_tool", "invariant_id": "TL-LEND-INV03", "condition": "returned_at IS NULL" } ] }
```

A value type that checks its value object's constraints, and a standard rule a handler meets:

```
value_object_add_value_type { "id": "TL-VO02-VT", "title": "parseEmail", "value_object_id": "TL-VO02", "file": "src/model.ts" }
standard_add_standard { "id": "TL-STD-CODE", "title": "Code", "product_id": "TL", "description": "How the library's code is written." }
standard_add_standard_rule { "id": "TL-STD-CODE-R01", "title": "Errors carry a code and a sentence", "standard_id": "TL-STD-CODE",
       "statement": "Every refusal MUST be an error with a machine-readable code and a sentence for people." }
command_change_command_handler { "id": "TL-LEND-CMD05-H", "meets": ["TL-STD-CODE-R01"] }
```

When a file moves, change the record's `file`: `command_change_command_handler { "id": "TL-LEND-CMD05-H", "file": "src/lending/borrow.ts" }`.

## Rules

- One technical record per design record: a second is refused.
- A record whose `file` does not exist yet is not built; it is built once the file is written.
- Describe what in the file implements the record, by name, so a reader can find it.
- An endpoint handler's file names its endpoint's method and route, and a UI component's file the route of a view it renders, any way routes are written (`/tools/{toolId}`, `/tools/:id`, a regular expression, or a comment); otherwise `endpoint-route-not-in-file` or `view-route-not-in-file` is an error. Every route the code serves, in the handlers' files and the files `routers` in `lathe.config.json` names, needs an endpoint or a view (the `route-without-record` gap).
- A technical kind has no test kind of its own: it is proved by the tests of what it implements (see `plan-tests`).
- Finish with the `check-and-fix` skill.
