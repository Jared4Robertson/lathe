# Database first: the schema and the store (brief 98's interfaces)

The store's interfaces: what the engine, the CLI and MCP tools, and the app build on. The code is `lathe/schema/` (the migrations) and `lathe/src/store/` (the store), exported from `@jaredrob/lathe`.

## How it fits together

- **Schema.** `lathe/schema/NNN-name.sql`, applied in order (001 meta, 002 registry and supertypes, 003 product, 004 domain model, 005 use cases, 006 shared, 007 interaction design, 008 technical specification, 009 test plan and questions, 010 links, 011 checking, 012 product kinds). Every table has a `COMMENT`, every stored column too; `describeSchema` reads tables, columns, types, enums, keys, foreign keys, CHECKs and comments back from DuckDB, plus the `meta_*` rows (kinds with labels, stages, folders, obligation, ID patterns and parents; relations with labels, roles and allowed pairs; supertype members; sections). New fields come by a new numbered migration; then `npm --prefix lathe run schema` regenerates `lathe/src/store/tables.ts` (a test fails until it does).
- **Table roles** (`meta_table.role`): `kind` (one row per record, `id` a foreign key into `record_id`), `part` (rows owned by one record, removed with it; `owner_column` names it), `link` (one table per relation: `source_id`, `target_id`, primary key both), `declaration` (a product's kinds and relations), `checking` (`check`, `product_setting`), and the unstored `meta`, `registry`, `supertype` and `result` (`problem`).
- **Data files.** `data/<table>.jsonl` for each stored table with rows (no file when empty; default folder `data/`, or `"data"` in `lathe.config.json`). Rows sorted by primary key (numbers as numbers, text by code point), columns in the table's order, columns without a value left out (never `null`), one JSON object per line, UTF-8, trailing newline. `record_id` and the supertypes are derived from the kind tables on load; they are never stored.
- **Load and write.** One DuckDB instance per process. Each load and each write builds the new state in a fresh in-memory database (schema copied from a cached schema database, then every table in dependency order, a self-referencing table such as `layer` level by level), inside one transaction, then runs the validation queries; only then does it replace the current state and rewrite the files of the tables it changed (through a temporary file and a rename). DuckDB checks foreign keys per statement even inside a transaction and refuses to delete or re-key a referenced row even when the same transaction drops the reference, which is why a write never updates in place. Measured on 2,000 records and 3,500 links (load average 5): opening takes about 0.4 s and a write about 0.14 s; a write on the small test fixture about 50 ms.
- **Parents.** `meta_kind_parent` lists each kind's parent kinds and columns, nearest first; a record's parent is the first of those columns with a value (the `record_parent` view). Kinds that sit in a domain through an optional container carry a required `domain_id` too, and a composite foreign key keeps the two consistent (`(capability_id, domain_id) -> capability (id, domain_id)`).
- **Views** in every data database: `record_parent (id, kind, parent_id)`, `record_scope (id, product_id, domain_id)` and `link (relation, source_id, target_id)`.

## Tables

The full description, with every column's meaning, is `store.schema` at run time and the comments in the migrations. In brief:

| Kind | Columns besides id and title (? = optional) | Parent, nearest first |
| --- | --- | --- |
| `aggregate` | domain_id, description?, identity?, notes? | domain |
| `api` | domain_id, description? | domain |
| `capability` | domain_id, position (int), description? | domain |
| `component` | domain_id, layer_id?, component_type, file, description? | layer, domain |
| `design_flow` | domain_id, layer_id?, description?, notes? | layer, domain |
| `design_step` | design_flow_id, path, position (int), description?, transaction_name?, locks?, statements? | design_flow |
| `domain` | product_id, description?, notes? | product |
| `domain_event` | aggregate_id, description? | aggregate |
| `domain_rule` | domain_id, aggregate_id?, entity_id?, statement | entity, aggregate, domain |
| `endpoint` | domain_id, api_id?, method (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS), route, description?, notes? | api, domain |
| `entity` | aggregate_id, role (root/child), description? | aggregate |
| `flow` | domain_id, capability_id?, description? | capability, domain |
| `flow_step` | flow_id, path, position (int), description? | flow |
| `integration` | domain_id, system?, description? | domain |
| `interaction_requirement` | domain_id, view_id?, endpoint_id?, flow_id?, api_id?, integration_id?, statement, group_name? | view, endpoint, flow, api, integration, domain |
| `layer` | domain_id, parent_layer_id?, position (int), description? | layer, domain |
| `pattern` | product_id, description?, notes? | product |
| `pattern_rule` | pattern_id, statement, group_name?, setting?, applies_when_setting?, applies_when_negated? (bool), applies_when_value?, notes? | pattern |
| `product` | description?, icon?, color?, notes? | none |
| `question` | product_id, domain_id?, aggregate_id?, use_case_id?, component_id?, owner, description? | aggregate, use_case, component, domain, product |
| `requirement` | use_case_id, statement, group_name? | use_case |
| `standard` | product_id, description? | product |
| `standard_rule` | standard_id, statement, group_name? | standard |
| `test` | domain_id, capability_id?, test_type, state (automated/manual/planned), file?, key?, key_file?, given?, when?, then?, notes? | capability, domain |
| `use_case` | domain_id, capability_id?, goal?, notes? | capability, domain |
| `view` | domain_id, route?, description?, notes? | domain |

| Part, checking or declaration table | Key | Columns |
| --- | --- | --- |
| `api_shape` (part) | api_id, position | api_id, position, name, meaning, fields |
| `check` (checking) | name | name, product_id?, position, severity (error/warning/error_or_warning), summary, explanation, query, kinds? |
| `entity_field` (part) | entity_id, position | entity_id, position, name, meaning, type, example? |
| `event_field` (part) | domain_event_id, position | domain_event_id, position, name, meaning, type, example? |
| `pattern_setting` (part) | pattern_id, position | pattern_id, position, name, meaning? |
| `product_kind` (declaration) | name | name, product_id, label, description, parent_kind, stage? (define/design), section?, obligation (none/full/proof), id_pattern?, id_example? |
| `product_kind_field` (declaration) | kind, position | kind, position, name, type (text/integer/boolean/date), required, description |
| `product_relation` (declaration) | name, source_kind, target_kind | name, source_kind, target_kind, product_id, role? (design/proof), forward_label, reverse_label, description |
| `product_setting` (checking) | product_id | product_id, max_children |
| `role` (part) | product_id, name | product_id, name, description? |
| `setting_value` (part) | follower_id, pattern_id, setting | follower_id, pattern_id, setting, value?, not_applicable? |
| `use_case_actor` (part) | use_case_id, position | use_case_id, position, role_name |
| `use_case_step` (part) | use_case_id, position | use_case_id, position, description |

| Relation | source_id points at | target_id points at | Pairs |
| --- | --- | --- | --- |
| `about` | question | record_id | question→* |
| `applies` | use_case | domain_rule | use_case→domain_rule |
| `carries_out` | flow | use_case | flow→use_case |
| `covers` | test | component | test→component |
| `deepens` | design_flow | flow | design_flow→flow |
| `depends_on` | component | component | component→component |
| `follows` | follows_source | pattern | domain→pattern, use_case→pattern |
| `fulfills` | fulfills_source | obligation | endpoint→requirement, flow→domain_rule, flow→interaction_requirement, flow→requirement, flow_step→domain_rule, flow_step→interaction_requirement, flow_step→pattern_rule, flow_step→requirement, interaction_requirement→domain_rule, interaction_requirement→pattern_rule, interaction_requirement→requirement, view→requirement |
| `has_many` | entity | entity | entity→entity |
| `has_one` | entity | entity | entity→entity |
| `implements` | component | implements_target | component→endpoint, component→view |
| `involves` | domain_rule | aggregate | domain_rule→aggregate |
| `meets` | meets_source | standard_rule | component→standard_rule, design_step→standard_rule, test→standard_rule |
| `proves` | test | obligation | test→domain_rule, test→interaction_requirement, test→pattern_rule, test→requirement |
| `raised_by` | domain_event | entity | domain_event→entity |
| `reacts_to` | reacts_to_source | domain_event | aggregate→domain_event, component→domain_event, use_case→domain_event |
| `refers_to` | entity | entity | entity→entity |
| `relates_to` | aggregate | aggregate | aggregate→aggregate |
| `runs` | test | flow | test→flow |
| `satisfies` | satisfies_source | obligation | component→domain_rule, component→interaction_requirement, component→pattern_rule, component→requirement, design_step→domain_rule, design_step→interaction_requirement, design_step→pattern_rule, design_step→requirement |
| `supports` | test | obligation | test→domain_rule, test→interaction_requirement, test→pattern_rule, test→requirement |
| `uses` | uses_source | uses_target | design_step→component, flow→endpoint, flow→view, flow_step→component, flow_step→endpoint, flow_step→view, view→endpoint |

| Supertype | Members |
| --- | --- |
| `follows_source` | domain, use_case |
| `fulfills_source` | endpoint, flow, flow_step, interaction_requirement, view |
| `implements_target` | endpoint, view |
| `meets_source` | component, design_step, test |
| `obligation` | domain_rule, interaction_requirement, pattern_rule, requirement |
| `reacts_to_source` | aggregate, component, use_case |
| `satisfies_source` | component, design_step |
| `uses_source` | design_step, flow, flow_step, view |
| `uses_target` | component, endpoint, view |


A product kind (a `product_kind` row with its `product_kind_field` rows) gets a table of its own named after it: `id`, `title`, `<parent_kind>_id` (required, a foreign key to the parent kind's table), then its fields typed `text`, `integer`, `boolean` or `date`, `NOT NULL` when required. An obligation kind joins the `obligation` supertype. A `product_relation` with a new name gets a link table (its ends point at the one source or target kind, else at `record_id`); one with Lathe's name adds a pair to that relation when the link table's ends accept the two kinds. A product kind may not take a table name Lathe has, and Lathe's own kinds cannot be widened (a different parent or more required fields): that is a migration.

## What the database enforces, and the validation queries

Constraints: primary keys, unique keys (a capability's place in its domain; a step's path and place in its flow; a field's position and name in its entity, event, API or pattern), foreign keys (every parent, every link end, a pattern rule's setting and applies-when setting, a setting value's pattern setting and its `follows` link), `NOT NULL`, enums, and CHECKs (non-empty titles and statements, IDs and names shaped, positions from 1, an interaction requirement or question under at most one container, an automated test names its file, a `key_file` needs a `file`, a layer not its own parent, no self-link in `relates_to`, `depends_on`, `has_one`, `has_many`, `refers_to`, applies-when given whole or not at all, a setting value either a value or a not-applicable reason). The store also refuses, before the database sees a row: an unknown column, a value of the wrong type (text, whole number, true/false, a real `YYYY-MM-DD` date, a list of texts), an empty text, a missing required column, a duplicate key in a file, and an ID used twice across kinds.

Validation queries (`validationQueries(schema)`, run in each write's transaction; each returns `table_name, row_key, message`):

| Rule | What it checks |
| --- | --- |
| `relation-pair` | A link joins two kinds its relation allows (`meta_relation_pair`), where a supertype end accepts more kinds than the relation does, such as a view that `fulfills` a domain rule. |
| `link-crosses-product` | A link's source and target sit in the same product. |
| `aggregate-root` | An aggregate with entities has exactly one root. |
| `product-kind-product` | A record of a product's kind sits in the product that declares the kind. |

## Interfaces

```ts
// Open and read
openStore(root: string, options?: { dataDir?: string }): Promise<Store>   // throws StoreError
store.schema: SchemaDescription          // tables, loadOrder, kinds, relations, supertypes, sections (product kinds included)
store.dataDir: string
store.rows(table: string): Row[]         // sorted by key
store.record(id: string): { kind: string; row: Row } | undefined
store.origin(row: Row): Origin | undefined          // { file, line } or { command }
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
SCHEMA_DIR, STORED_ROLES; row types in tables.ts (ProductRow ... TestRow, TableRows, TableName)
normalizeRow(table, value), tableText(table, rows), rowLine(table, row), sortRows(table, rows)

// Merge driver
mergeData(base: string, ours: string, theirs: string, table: TableDescription | null): Promise<MergeResult>
mergeDataFiles(basePath, oursPath, theirsPath, filePath): Promise<MergeResult>   // { text, clashes, problems }
lathe merge-data %O %A %B %P
```

What a command does:
- **add** puts a row in a kind, part, declaration or checking table (links use `link`). A record gets its registry and supertype rows.
- **set** changes or clears columns; the key and a record's parent columns stay.
- **move** gives the record its new parent's column, and fills the other parent columns that are required or share a foreign key with it from the new parent's ancestry (a domain rule moved under an entity takes the entity's aggregate and domain; an interaction requirement moved under an API drops its endpoint). Records inside it keep their parents and take the new derived columns, so moving a capability to another domain carries its use cases, flows and tests along.
- **remove** takes a record with its parts (rows of part tables it owns, such as entity fields, use case actors and steps, and setting values) and the links it starts. Anything else that still references it (a child, a link to it, a row naming it) refuses the removal, listing up to 20 referrers.

## For the later briefs

- **Import (99).** Bodies go to `description`, `statement`, `goal`, `given`/`when`/`then` and `notes`; the kinds with `notes` are product, domain, aggregate, use case, pattern, pattern rule, view, endpoint and technical flow. Header renames: `order` is `position`, a test's `run_by` is `file`, `group` is `group_name`, `transaction` is `transaction_name`, a question's `owner` stays `owner`. A use case's `actor` becomes `use_case_actor` rows; a product's `actors` become `role` rows; a pattern's `settings` become `pattern_setting` rows; a follower's setting header fields become `setting_value` rows (`Not applicable: <reason>` goes in `not_applicable`); `applies_when: record is Tool` becomes `applies_when_setting`, `applies_when_negated`, `applies_when_value`. A step with no path gets `path: main`; a test with no state gets `state: automated`. Fields and Shapes tables become `entity_field`, `event_field` and `api_shape` rows; a use case's numbered steps become `use_case_step` rows. Test fixtures' `metaExtensions` become `product_kind`, `product_kind_field` and `product_relation` rows; one that widens a Lathe kind cannot be declared and is reported. Lathe's own checks need a home for their rows (a data folder in the package, loaded beside the product's); the store loads one folder today.
- **Engine.** `problem` is the table a check run fills; `product_setting.max_children` replaces `structure.maxChildren`. The `schema and the meta-model CSVs` tests in `lathe/test/store/schema.test.ts` hold the schema to `lathe/meta/*.csv` until the cutover deletes them; delete those tests with the CSVs.
- **App and writers.** Forms read `store.schema.tables[name].columns` (kind, enum values, required, description) and `kinds[name].parents`. Writes go through `store.apply`; show `StoreError.problems` with their `command` index.
