# The store's interfaces

What the engine, the CLI and MCP tools, and the app build on: the schema in `lathe/schema/` and the store in `lathe/src/platform/data/`, exported from `@jaredrob/lathe`. The model is concrete kinds from DDD, CQRS and event storming, each record with exactly one parent; `lathe/REFERENCE.md` describes every kind.

## How it fits together

- **Schema.** `lathe/schema/NNN-name.sql`, applied in order: 001 meta (stages, kinds, parents, relations, supertypes), 002 registry and supertypes, 003 product (and discovery's business outcomes), 004 domain model, 005 use cases (and patterns), 006 interaction design, 007 technical specification (and standards), 008 test plan, 009 open questions, 010 links, 011 checking, 012 product kinds. There are no upgrade migrations: the database is rebuilt from the data files on every load, so a change to the model rewrites these files and the data with it. Every table has a `COMMENT`, every stored column too. `describeSchema` reads tables, columns, types, enums, keys, foreign keys, CHECKs and comments back from DuckDB, plus the `meta_*` rows. After a change, `npm --prefix lathe run schema` regenerates `lathe/src/platform/data/tables.ts` (a test fails until it does).
- **Stages.** `meta_stage`, in order: `discovery`, `domain-model`, `use-cases`, `interaction-design`, `technical-specification`, `test-plan`. Each kind has a stage and a `position` (stage by stage, the plan's order within each); product and open question have no stage, product first and question last. Patterns sit in use cases, standards in the technical specification. Folders (`meta_section`) are gone: a kind's stage is its folder.
- **Table roles** (`meta_table.role`): `kind` (one row per record, `id` a foreign key into `record_id`), `part` (rows owned by one record, removed with it; `owner_column` names it), `link` (one table per relation: `source_id`, `target_id`, primary key both), `declaration` (a product's kinds and relations), `checking` (`check`, `product_setting`), and the unstored `meta`, `registry`, `supertype` and `result` (`problem`).
- **Data files.** `data/<table>.jsonl` for each stored table with rows (no file when empty; default folder `data/`, or `"data"` in `lathe.config.json`). Rows sorted by primary key (numbers as numbers, text by code point), columns in the table's order, columns without a value left out (never `null`), one JSON object per line, UTF-8, trailing newline. `record_id` and the supertypes are derived from the kind tables on load; they are never stored.
- **Load and write.** One DuckDB instance per process. Before a load's first query of the data (the integrity queries, the checks, coverage), the store seals the instance (`seal` in `store.ts`, with the settings in the Check aggregate's `sealDatabase`, LA-CHK-INV06): no file, URL or extension, locked settings, no proxy from the environment. The settings are global, so the instance stays sealed until `closeEngine`; the schema cache's attaches and writes finish before it, and a sealed instance builds a schema afresh rather than reading or writing a cache file. A cache file is copied into memory and detached, never left attached: DuckDB keeps an attached database's files, and those beside them, open to every query of a sealed instance. Each load and each write builds the new state in a fresh in-memory database (schema copied from a cached schema database, then every table in dependency order), inside one transaction, then runs the validation queries; only then does it rewrite the files of the tables it changed, all or nothing, and replace the current state: every new file goes into `data/.lathe-write/` (ignored by git), then a journal, then each is renamed into place; the next load or reload after a crash finishes a write whose journal is there and rolls back one whose journal is not, and says which (`platform/data/journal.ts`). DuckDB checks foreign keys per statement even inside a transaction and refuses to delete or re-key a referenced row even when the same transaction drops the reference, which is why a write never updates in place.
- **One parent.** `meta_kind_parent` lists the kinds a kind may sit under and the column naming each. Most kinds have one, a required column. Three have two, both optional with a CHECK that exactly one holds a value: an endpoint under its command or query, a table under its entity or read model, an open question under its product or a domain. A record's domain and product follow from its parent chain; nothing stores them twice.
- **No owner.** Value objects, specifications, views, integrations and UI components have no parent column (`parents` is empty). Their product, and a specification's domain, follow from their ID's prefix: the longest product (or domain) ID that, with a hyphen, starts it. `meta_kind.id_scope` says what every kind's IDs start with: `product`, `domain` or `parent` (none for a product's own kind).
- **Derived domain.** A view, integration, UI component or value object belongs to the domain that uses it, worked out by `record_scope` and never stored: a view the domains of the flow steps that happen in it, an integration those of the flow steps that exchange with it, a UI component those that use the views it renders, a value object those of the entities, events and read models whose fields it types. Exactly one using domain is its domain; two or more, or none, leave it in no domain, and the product shares it (the app's Shared folder, with the patterns and standards). What sits under it follows it. IDs stay product-scoped (`TL-V01`), so gaining a second using domain moves a record to Shared with no rename and no data change.
- **Views and tables** in every data database: the views `record_parent (id, kind, parent_id)` (none for a product and a kind with no owner) `link (relation, source_id, target_id)` and `record_group (id, label)` (every record that names a group among its siblings, with the group as written: a flow step's `path`, and the `group_name` of every stored kind that has one, Lathe's and a product's own alike; a record with no group has no row), and the table `record_scope (id, product_id, domain_id, aggregate_id)`, worked out once per data database after its rows are in (a data database never changes after it is built): through the parents, a specification's domain from its ID, and the derived domain of the other kinds with no owner.

## Tables

The full description, with every column's meaning, is `store.schema` at run time and the comments in the migrations. **Run by**, on every test kind: `level` (how it runs, cheapest first: unit, integration, service, system, browser; a manual test names the level a person exercises, and a test runs at the lowest level that can observe its result), `state` (automated, manual, not automated yet), `file?` (required when automated), `manual_reason?` (required when manual, and only then), `size?` (volume or worst case; none is small) and the markers `smoke?` and `external?` (only true; none is no).

| Stage | Kind | Parent | Columns besides id and title (? = optional) | ID |
| --- | --- | --- | --- | --- |
| — | `product` | none | description, icon?, color?, notes? | `<P>` |
| discovery | `business_outcome` | product (product_id) | statement, measure, target, measured_outside?, notes? | `<P>-BO<nn>` |
| domain-model | `domain` | product (product_id) | subdomain_type (core/supporting/generic), description, notes? | `<P>-<D>` |
| domain-model | `aggregate` | domain (domain_id) | description, identity, notes? | `<P>-<D>-A<n>` |
| domain-model | `entity` | aggregate (aggregate_id) | role (root/child), in_root_table? (bool), description | `<P>-<D>-EN<nn>` |
| domain-model | `value_object` | none | description | `<P>-VO<nn>` |
| domain-model | `constraint` | value_object (value_object_id) | statement | `<value object>-C<nn>` |
| domain-model | `invariant` | aggregate (aggregate_id) | statement | `<P>-<D>-INV<nn>` |
| domain-model | `specification` | none | statement | `<P>-<D>-SP<nn>` |
| domain-model | `domain_event` | aggregate (aggregate_id) | published (bool), description | `<P>-<D>-EV<nn>` |
| domain-model | `command` | aggregate (aggregate_id) | description | `<P>-<D>-CMD<nn>` |
| domain-model | `read_model` | domain (domain_id) | description | `<P>-<D>-RM<nn>` |
| domain-model | `query` | read_model (read_model_id) | description | `<P>-<D>-QRY<nn>` |
| domain-model | `policy` | command (command_id) | statement | `<P>-<D>-PO<nn>` |
| domain-model | `domain_service` | domain (domain_id) | statement | `<P>-<D>-DS<nn>` |
| domain-model | `storage_requirement` | aggregate (aggregate_id) or read_model (read_model_id), exactly one | statement | `<aggregate or read model>-SR<nn>` |
| domain-model | `term` | domain (domain_id) | meaning, group_name? | `<P>-<D>-TM<nn>` |
| use-cases | `capability` | domain (domain_id) | position (int), description | `<P>-<D>-CAP<nn>` |
| use-cases | `use_case` | capability (capability_id) | goal, notes? | `<P>-<D>-UC<nn>` |
| use-cases | `uc_requirement` | use_case (use_case_id) | statement, group_name? | `<use case>-R<nn>` |
| use-cases | `pattern` | product (product_id) | description, notes? | `<P>-PAT-<name>` |
| use-cases | `pattern_rule` | pattern (pattern_id) | statement, group_name?, notes? | `<pattern>-R<nn>` |
| interaction-design | `interface` | product (product_id) | kind (web app/API/CLI/agent tools/desktop/other), description, public; its roles as `interface_actor` rows | `<P>-IF<nn>` |
| interaction-design | `flow` | use_case (use_case_id, one flow per use case) | title (its use case's) | `<use case>-FL` |
| interaction-design | `flow_step` | flow (flow_id) | path, position (int), interface_id? (the one interface it is a variant of) | `<flow>-S<nn>` |
| interaction-design | `view` | none | route?, interface_id? (the one interface that shows it), description, notes? | `<P>-V<nn>` |
| interaction-design | `view_requirement` | view (view_id) | statement, group_name? | `<view>-R<nn>` |
| interaction-design | `endpoint` | command (command_id) or query (query_id) | method (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS), route, description, notes? | `<P>-<D>-EP<nn>` |
| interaction-design | `api_requirement` | endpoint (endpoint_id) | statement, group_name? | `<endpoint>-R<nn>` |
| interaction-design | `integration` | none | system?, description | `<P>-INT<nn>` |
| technical-specification | `data_store` | product (product_id) or domain (domain_id), exactly one | kind (database/object store/file folder/file/browser storage/memory), description | `<P>-STORE<nn>` or `<P>-<D>-STORE<nn>` |
| technical-specification | `repository` | domain (domain_id) | file?, description | `<domain>-REPO<nn>` |
| technical-specification | `data_model` | entity (entity_id) | file? | `<entity>-DM` |
| technical-specification | `table` | entity (entity_id) or read_model (read_model_id) | name, storage (table/view/materialized view/browser storage/file/in memory), file? | `<entity or read model>-TB` |
| technical-specification | `value_type` | value_object (value_object_id) | file? | `<value object>-VT` |
| technical-specification | `predicate` | specification (specification_id) | file? | `<specification>-PR` |
| technical-specification | `event_type` | domain_event (domain_event_id) | delivery? (in process/outbox), file? | `<domain event>-ET` |
| technical-specification | `projection` | read_model (read_model_id) | file?, description | `<read model>-PJ` |
| technical-specification | `command_handler` | command (command_id) | file?, description | `<command>-H` |
| technical-specification | `query_handler` | query (query_id) | file?, description | `<query>-H` |
| technical-specification | `event_handler` | policy (policy_id) | file?, description | `<policy>-H` |
| technical-specification | `service` | domain_service (domain_service_id) | file? | `<domain service>-SV` |
| technical-specification | `ui_component` | none | file?, description | `<P>-UI<nn>` |
| technical-specification | `endpoint_handler` | endpoint (endpoint_id) | file?, description | `<endpoint>-H` |
| technical-specification | `adapter` | integration (integration_id) | file?, description | `<integration>-AD` |
| technical-specification | `standard` | product (product_id) | description | `<P>-STD-<name>` |
| technical-specification | `standard_rule` | standard (standard_id) | statement, group_name? | `<standard>-R<nn>` |
| test-plan | `test_data_set` | domain (domain_id) | environment, accounts?, records, prepare, reset, file?, description | `<P>-<D>-TD<nn>` |
| test-plan | `constraint_test` | constraint (constraint_id) | run by, accepts, refuses, notes? | `<constraint>-T` |
| test-plan | `invariant_test` | invariant (invariant_id) | run by, when, then, notes? | `<invariant>-T` |
| test-plan | `specification_test` | specification (specification_id) | run by, when, then, notes? | `<specification>-T` |
| test-plan | `policy_test` | policy (policy_id) | run by, when, then, notes? | `<policy>-T` |
| test-plan | `domain_service_test` | domain_service (domain_service_id) | run by, when, then, notes? | `<domain service>-T<nn>` |
| test-plan | `storage_requirement_test` | storage_requirement (storage_requirement_id) | run by, when, then, notes? | `<storage requirement>-T<nn>` |
| test-plan | `use_case_test` | uc_requirement (uc_requirement_id) | run by, when, then, notes? | `<UC requirement>-T<nn>` |
| test-plan | `view_test` | view_requirement (view_requirement_id) | run by, when, then, notes? | `<view requirement>-T<nn>` |
| test-plan | `endpoint_test` | api_requirement (api_requirement_id) | run by, when, then, notes? | `<API requirement>-T<nn>` |
| test-plan | `flow_test` | flow (flow_id) | run by, steps (list), expected_result, notes? | `<flow>-T` |
| test-plan | `integration_test` | integration (integration_id) | run by, when, then, notes? | `<integration>-T<nn>` |
| test-plan | `pattern_rule_test` | pattern_rule (pattern_rule_id) | domain_id, run by, when, then, notes? | `<pattern rule>-T<nn>` |
| test-plan | `standard_rule_test` | standard_rule (standard_rule_id) | run by, when, then, notes? | `<standard rule>-T<nn>` |
| — | `question` | product (product_id) or domain (domain_id) | owner, description | `<P>-Q<nn> or <P>-<D>-Q<nn>` |

| Part, checking or declaration table | Key | Columns |
| --- | --- | --- |
| `check` (checking) | name | name, product_id?, position (int), severity (error/warning/error_or_warning), summary, explanation, query, kinds? (list) |
| `entity_field` (part) | entity_id, position | entity_id, position (int), name, meaning, type? (text/whole number/decimal/date/time/date and time/yes/no), type_value_object_id?, type_aggregate_id?, required (bool), column_name?, example? |
| `event_field` (part) | domain_event_id, position | domain_event_id, position (int), name, meaning, type? (text/whole number/decimal/date/time/date and time/yes/no), type_value_object_id?, type_aggregate_id?, required (bool), column_name?, example? |
| `interface_actor` (part) | interface_id, position | interface_id, position (int), role_name |
| `pattern_setting` (part) | pattern_id, position | pattern_id, position (int), name, meaning |
| `product_kind` (declaration) | name | name, product_id, label, description, parent_kind, stage? (domain-model/use-cases/interaction-design/technical-specification/test-plan), obligation (bool), id_pattern?, id_example? |
| `product_kind_field` (declaration) | kind, position | kind, position (int), name, type (text/integer/boolean/date), required (bool), description; a field named statement, goal, meaning or description is the kind's lead: at most one, and required |
| `product_relation` (declaration) | name, source_kind, target_kind | name, source_kind, target_kind, product_id, role? (design/proof), forward_label, reverse_label, description |
| `product_setting` (checking) | product_id | product_id, max_children (int), max_entities_per_aggregate (int) |
| `read_model_field` (part) | read_model_id, position | read_model_id, position (int), name, meaning, type? (text/whole number/decimal/date/time/date and time/yes/no), type_value_object_id?, type_aggregate_id?, required (bool), column_name?, example? |
| `role` (part) | product_id, name | product_id, name, description |
| `setting_value` (part) | follower_id, pattern_id, setting | follower_id, pattern_id, setting, value |
| `table_key` (part) | table_id, position | table_id, position (int), type (primary/unique/foreign/index), columns (list), name?, invariant_id?, target_table_id?, condition? |
| `use_case_actor` (part) | use_case_id, position | use_case_id, position (int), role_name |
| `value_object_field` (part) | value_object_id, position | value_object_id, position (int), name, meaning, type? (text/whole number/decimal/date/time/date and time/yes/no), type_value_object_id?, type_aggregate_id?, required (bool), column_name?, example? |

| Relation | Scope | Source | Target | Pairs |
| --- | --- | --- | --- | --- |
| `about` | product | question | record_id | question→* |
| `calls` | domain | operation | domain_service | command→domain_service, query→domain_service |
| `checks` | domain | command | specification | command→specification |
| `exchanges_with` | product | flow_step | integration | flow_step→integration |
| `follows` | product | follows_source | pattern | domain→pattern, use_case→pattern, interface→pattern |
| `fulfills` (design) | product | flow_step | uc_requirement | flow_step→uc_requirement |
| `has_many` | product | entity | entity | entity→entity |
| `has_one` | product | entity | entity | entity→entity |
| `hears` (one per source) | product | policy | domain_event | policy→domain_event |
| `invokes` (one per source) | product | flow_step | operation | flow_step→command, flow_step→query |
| `measured_by` | product | business_outcome | record_id | 12 pairs: business_outcome→every test kind; a product adds its own kinds with a product_relation named measured_by |
| `meets` | product | technical_record | standard_rule | 14 pairs: every member of technical_record (the technical kinds; a standard rule is proved by its standard rule tests) |
| `offers` | product | interface | use_case | interface→use_case |
| `persists` (one per source, one per target) | product | repository | aggregate | repository→aggregate |
| `stored_in` (one per source) | product | stored_in_source | data_store | repository→data_store, reader→data_store, table→data_store |
| `presents` | product | view | operation | view→command, view→query |
| `provided_by` (one per source) | product | data_store | integration | data_store→integration |
| `raises` | aggregate | command | domain_event | command→domain_event |
| `reads` | domain | reads_source | aggregate | read_model→aggregate, specification→aggregate |
| `renders` | product | ui_component | view | ui_component→view |
| `selects_by` | domain | query | specification | query→specification |
| `serves` | product | capability | business_outcome | capability→business_outcome |
| `starts_from` | product | test | test_data_set | 12 pairs: every test kind→test_data_set |

| Supertype | Members |
| --- | --- |
| `follows_source` | domain, use_case |
| `technical_record` | adapter, command_handler, data_model, endpoint_handler, event_handler, event_type, predicate, projection, query_handler, repository, service, table, ui_component, value_type |
| `obligation` | api_requirement, constraint, domain_service, invariant, pattern_rule, policy, specification, standard_rule, storage_requirement, uc_requirement, view_requirement |
| `stored_in_source` | reader, repository, table |
| `operation` | command, query |
| `reads_source` | read_model, specification |
| `test` | constraint_test, domain_service_test, storage_requirement_test, endpoint_test, flow_test, integration_test, invariant_test, pattern_rule_test, policy_test, specification_test, standard_rule_test, use_case_test, view_test |

Notes on the tables:
- **Fields.** `entity_field`, `value_object_field`, `event_field` and `read_model_field` share one shape. A field's type is exactly one of `type` (a basic type: text, whole number, decimal, date, time, date and time, yes/no), `type_value_object_id` or `type_aggregate_id` (a reference by ID; another domain's aggregate is allowed). `required` says whether every record gives it a value; `column_name` names its column when that differs from the field's name (Member ID in `id`). A name is unique in its owner, trimmed and in any letter case. An entity's value objects are the ones its fields are typed with: no link stores them twice.
- **Tables and keys.** A table's columns follow from its entity's or read model's fields (a value object's fields flattened), so `table` stores its `name`, `storage` (`table`, `view`, `materialized view`, `browser storage`, `file`, `in memory`; an entity's is never a view or a materialized view) and its `table_key` rows (none for browser storage, a file or in memory): `primary` (at most one), `unique` (with the `invariant_id` it enforces and a `condition` for a partial key, both optional), `foreign` (with its `target_table_id`, required, of the same domain) and `index`. An entity has at most one table: a child entity with `in_root_table: true` has none and is stored in its root's table.
- **Exactly one, at most one.** One flow per use case (`UNIQUE (use_case_id)`), one test per constraint, invariant, specification, policy and flow, one technical record per design record (and one table per entity or read model): a `UNIQUE` parent column. One pattern rule test per rule and domain: `UNIQUE (pattern_rule_id, domain_id)`. A policy hears one event, a step invokes one operation: link tables with a unique `source_id`. "At least one" is a check's to report, never a refusal.
- **Product kinds.** A `product_kind` row with its `product_kind_field` rows gets a table of its own named after it: `id`, `title`, `<parent_kind>_id` (required, a foreign key to the parent kind's table), then its fields typed `text`, `integer`, `boolean` or `date`, `NOT NULL` when required. It may sit in any of the six stages (or none) under any kind, with its own free-form ID pattern (no `id_scope`). `obligation: true` joins the `obligation` supertype. A `product_relation` with a new name gets a link table of scope `product` (its ends point at the one source or target kind, else at `record_id`); one with Lathe's name adds a pair to that relation when the link table's ends accept the two kinds. A product kind may not take a table name Lathe has.

## What the database refuses, and the validation queries

Constraints: primary keys, unique keys (above, and a capability's place in its domain, a step's path and place in its flow, a field's position and name, a pattern setting's name), foreign keys (every parent, every link end, every field's type, a key's invariant and target table, a pattern rule's setting and applies-when setting, a setting value's pattern setting and its `follows` link), `NOT NULL`, enums, and CHECKs (non-empty titles and statements, IDs and names shaped, positions from 1, exactly one of two parents, exactly one type per field, a value object field not typed by its own value object, `in_root_table` only true and only on a child, an entity's table stored as `table`, a key's invariant and condition only on a unique key and its target table exactly on a foreign key, an automated test names its file, a manual test and only a manual test gives its reason, no self-link in `has_one` and `has_many`, applies-when given whole or not at all, a setting value either a value or a not-applicable reason). The store also refuses, before the database sees a row: an unknown column, a value of the wrong type (text, whole number, true/false, a real `YYYY-MM-DD` date, a list of texts), an empty text, a missing required column, a duplicate key in a file, and an ID used twice across kinds.

Validation queries (`validationQueries(schema)`, run on each new data database just after its rows commit, while it is still private, so a refusal drops it whole; each returns `table_name, row_key, message`):

| Rule | What it refuses |
| --- | --- |
| `relation-pair` | A link between two kinds its relation does not allow (`meta_relation_pair`), where a supertype or `record_id` end accepts more. |
| `link-crosses-product` | A link whose ends sit in different products (an ownerless record's product comes from its ID). |
| `link-scope` | A link of a `domain`-scoped relation across domains (`checks`, `reads`, `selects_by`, `calls`), or of the `aggregate`-scoped `raises` across aggregates. |
| `step-fulfills-own-use-case` | A flow step fulfilling a UC requirement of another use case. |
| `flow-id` | A flow whose ID is not its use case's ID and FL. |
| `policy-hears-published` | A policy hearing another domain's event that is not published. |
| `id-prefix` | An ID that does not start with its scope's ID and a hyphen: its parent's, its domain's (so a query and its read model, or an endpoint and its operation, are of one domain) or its product's; and an ownerless record whose prefix names no product, or for a specification no domain. |
| `aggregate-root` | An aggregate with more than one root entity. |
| `entity-table` | A table of its own for an entity stored in its root's table. |
| `one-primary-key` | A table with more than one primary key. |
| `key-outside-database` | A key of a table kept in browser storage, a file or in memory, or a foreign key to one. |
| `foreign-key-crosses-domain` | A foreign key to a table of another domain. |
| `reference-crosses-product` | A field's value object or aggregate, a key's invariant or target table, or a pattern rule test's domain, in another product. |
| `product-kind-product` | A record of a product's own kind outside the product that declares it. |

## Interfaces

```ts
// Open and read
openStore(root: string, options?: { dataDir?: string; latheDataDir?: string | null }): Promise<Store>   // throws StoreError
store.schema: SchemaDescription          // { tables, loadOrder, kinds, relations, supertypes, stages } (product kinds included)
store.dataDir: string
store.rows(table: string): Row[]         // sorted by key
store.record(id: string): { kind: string; row: Row } | undefined
store.origin(row: Row): Origin | undefined          // { file, line } or { command }
store.isBuiltIn(row: Row): boolean                  // a row of lathe/data (Lathe's own checks), read-only
store.query<T>(sql: string): Promise<T[]>           // on the current data
store.connection: DuckDBConnection                  // follows every write
store.connect(): Promise<DuckDBConnection>          // a side connection, valid until the next write
store.close(): Promise<void>

// Write: each is one transaction; apply runs several as one
store.add(table: string, row: Row): Promise<WriteResult>
store.set(table: string, key: KeyInput, changes: Record<string, Value | null>): Promise<WriteResult>  // null clears; not keys or parent columns
store.move(id: string, parent: string): Promise<WriteResult>
store.link(relation: string, source: string, target: string): Promise<WriteResult>
store.unlink(relation: string, source: string, target: string): Promise<WriteResult>
store.remove(table: string, key: KeyInput): Promise<WriteResult>
store.apply(commands: Command[]): Promise<WriteResult>   // { tables: string[]; files: string[] }
type KeyInput = string | Record<string, Value>           // a record's ID, or a row's primary key columns
type Row = Record<string, Value>; type Value = string | number | boolean | string[]

// Problems
class StoreError extends Error { problems: StoreProblem[] }
interface StoreProblem { rule: string; message: string; table?: string; key?: string; file?: string; line?: number; command?: number }
formatProblem(p: StoreProblem): string                    // "data/view.jsonl:2: ... [column]"

// Schema
readMigrations(dir?: string): Migration[]; applyMigrations(connection, migrations?): Promise<void>
describeSchema(connection): Promise<SchemaDescription>; validationQueries(schema): ValidationQuery[]
SCHEMA_DIR, STORED_ROLES, LATHE_DATA_DIR; row types in tables.ts (ProductRow ... QuestionRow, TableRows, TableName)
normalizeRow(table, value), tableText(table, rows), rowLine(table, row), sortRows(table, rows)
type Stage = 'domain-model' | 'use-cases' | 'interaction-design' | 'technical-specification' | 'test-plan'
type IdScope = 'product' | 'domain' | 'parent'; type LinkScope = 'product' | 'domain' | 'aggregate'
interface KindDescription { name; label; stage: Stage | null; position: number | null; obligation: boolean;
  idPattern; idExample; idScope: IdScope | null; productId; description; parents: KindParent[]; supertypes: string[] }
interface RelationDescription { name; role: 'design' | 'proof' | null; scope: LinkScope; forwardLabel; reverseLabel;
  productId; description; sourceTable; targetTable; pairs: RelationPair[] }
interface StageDescription { name: Stage; position: number; label: string; description: string }

// Merge driver
mergeData(base: string, ours: string, theirs: string, table: TableDescription | null): Promise<MergeResult>
mergeDataFiles(basePath, oursPath, theirsPath, filePath): Promise<MergeResult>   // { text, clashes, problems }
lathe merge-data %O %A %B %P
```

What a command does:
- **add** puts a row in a kind, part, declaration or checking table (links use `link`). A record gets its registry and supertype rows.
- **set** changes or clears columns; the key and a record's parent columns stay.
- **move** puts the record under a new parent of a kind it may sit under: that kind's column takes the parent's ID and the other parent column, if the kind has two, is cleared. What sits inside it moves along unchanged. A record with no owner cannot move. Domain-scoped IDs stay as they are, so a move to another domain is refused by `id-prefix`: give the record a new ID instead.
- **remove** takes a record with its parts (rows of part tables it owns, such as fields, actors, table keys and setting values) and the links it starts. Anything else that still references it (a child, a link to it, a field typed by it, a key naming it) refuses the removal, listing up to 20 referrers.

## Notes by part

- **Engine.** Coverage of obligations (designed, built, proved) and the "at least one" and "nothing uses it" checks are the engine's: none are refusals. `record_scope` has `aggregate_id` now; `meta_kind.obligation` is a boolean; sections are gone in favor of `schema.stages`. Allowed test levels per test kind are not in the schema. Coverage reports a business outcome no capability serves and a capability that serves none as gaps (`outcome-not-served`, `capability-serves-no-outcome`), and an outcome that gives no `measured_outside` and that no running test (manual, or automated and backed) and no record of a product's own kind measures (`outcome-not-measured`, in `lathe/src/trace/measures.ts`); the checks `test-data-set-unused` and `test-data-set-file-missing` report a data set no test starts from and one whose file is missing. Before the checks run the engine also fills `table_facts` (`lathe/src/trace/tables.ts`): each table kept in a database that names a file, read as text against its name, the columns its fields give and its primary, unique and foreign keys; `table-schema-mismatch` warns of each part the file does not define, and the gap `table-without-file` reports a table stored as a table that names no file.
- **App and writers.** Forms read `store.schema.tables[name].columns` (kind, enum values, required, description) and `kinds[name].parents` (zero, one or two) and `idScope`/`idPattern` to suggest IDs. Writes go through `store.apply`; show `StoreError.problems` with their `command` index.

## Later additions
- A `table` may sit under a domain (`domain_id`) for the domain's own infrastructure that implements no design record, such as its outbox: ID `<domain>-TB<nn>`, storage `table`. Exactly one of entity, read model and domain is given.
- `fed_by` links a read model to a domain event it is kept current from: its own domain's, or another domain's published one (`read-model-fed-by-published` refuses an unpublished event of another domain). This is how a read model shows another domain's data.
- `calls` may come from a read model too (its projection uses the domain service); its source is the `calls_source` supertype (command, query, read model).
- A workspace: `products` in `lathe.config.json` lists other products' folders, each with its own config and data and its own store (`workspaceProducts`, `loadProducts`). A read that names no record (the products, the meta model) reads every product's store under one schema joined from the products' (`joinSchemas`), refusing two folders that hold the same product; a read or a command that names a record goes to the store of the product that holds it.
