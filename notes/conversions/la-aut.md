# Conversion: LA-AUT (Authoring) to the new model

The sorting sheet for brief 107, domain LA-AUT. It lists Authoring's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, and closes with a table that accounts for every old record and link. It follows the Tool Library's sheet ([tool-library.md](tool-library.md)). Brief 111 applies it together with the other LA sheets.

Authoring is Lathe's own spec of its model, so most of it is rewritten rather than moved: the brief says to describe Lathe as the plan makes it. Every rewrite is listed in the Source column and under "Rewrites".

## Conventions
- **Source** names the old record (`DR04`, `UC05-R03`, `C46`, `T85` and so on, all `LA-AUT-` unless written in full) or the code (`lathe/src/…`).
- IDs are written short. In full, domain-scoped IDs start `LA-AUT-` (`A1` is `LA-AUT-A1`, `UC01-FL-S02` is `LA-AUT-UC01-FL-S02`); product-scoped IDs start `LA-` and are written in full.
- **Product-scoped numbers are provisional:** `LA-VO01`…, `LA-V01`…, `LA-INT01`…, `LA-UI01`… collide with what other LA sheets number. Brief 111 renumbers them across the product; this sheet's numbers only need to be unique inside it.
- **Types** are the schema's basic types, a value object (`VO01`…, short for `LA-VO01`) or a reference to an aggregate (`→ A1`).
- **New** marks a row with no old record. **To resolve** marks a link to another domain's old record that brief 111 settles with that domain's sheet.
- **Not built** and **not proved** mark obligations with no technical record or no test yet: these are left as gaps for coverage to report, and no test is invented for them.

## Product and domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA-AUT | Domain | Authoring | subdomain type **core**; description rewritten: "Writing a product down in Lathe's one language, as typed data: the fifty kinds from products and domains to tests, each record with one parent, the links between them, the kinds and relations a product declares as its own, and changing all of it through the command layer. The schema is the language, and the reference shows it whole."; notes as today | domain (its "layers, flows, views, endpoints" list and "Each of those concepts is an aggregate here" go) |

Product LA and its roles (Owner, Reader, Agent) are not Authoring's; nothing here changes them.

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| A1 | Product | LA-AUT | Product ID | A1, rewritten (judgment call 1): "A product's specification: the product and every record under it, of every kind, with their parts and links. It is one consistency boundary because the store checks each write against the whole product in one transaction, keeps each kind in one data file across the product, and refuses or accepts the write whole. What every record shares (an ID in the registry, a kind with its own table, a title, at most one parent, typed columns, part rows, and links as rows of their relations' tables) is described on the Product entity." |

A2 to A15 go: each was one concept of the old meta-model, and each concept is now an entity of A1 (table below). The accounting table says where each went.

### Entities

All sit in A1. EN01 Product is the root; every other entity is a child with a table of its own (`in_root_table` false). Each entity's description is its table's `COMMENT` in the schema, word for word, so the two never drift; the old descriptions of kept entities are replaced by it. Old entity numbers are kept where the entity keeps its role.

| ID | Title | Table | Source |
| --- | --- | --- | --- |
| EN01 | Product | product | EN01, root. Its description adds: "Every record under it shares one shape: an ID unique across every kind, a kind whose table holds it, a title, at most one parent (none for the product and for the five kinds with no owner), typed columns, part rows, and links as rows of each relation's table." |
| EN03 | Role | role | EN03 |
| EN02 | Product kind | product_kind | EN02 (its fields and relations become EN28 and EN29) |
| EN28 | Product kind field | product_kind_field | **New**: EN02 field 5 |
| EN29 | Product relation | product_relation | **New**: EN02 field 6 |
| EN04 | Domain | domain | EN04 |
| EN30 | Term | term | **New** (decision 9) |
| EN05 | Capability | capability | EN05 |
| EN06 | Aggregate | aggregate | EN06 |
| EN08 | Entity | entity | EN08 |
| EN07 | Entity field | entity_field | EN07 Field, renamed |
| EN31 | Value object | value_object | **New** (decision 2) |
| EN32 | Value object field | value_object_field | **New** |
| EN33 | Constraint | constraint | **New**: EN09's value-format rules (decision 3) |
| EN09 | Invariant | invariant | EN09 Domain rule, reshaped: a domain rule that holds for one aggregate is an invariant; the other three kinds of rule are EN33, EN34 and EN41 |
| EN34 | Specification | specification | **New**: EN09's yes-or-no checks across aggregates |
| EN10 | Domain event | domain_event | EN10 |
| EN35 | Event field | event_field | **New** as an entity: EN10's event_field rows (DR65) |
| EN36 | Command | command | **New** (decision 4) |
| EN37 | Command change | command_change | **New**: a command's recorded exception (decision 1) |
| EN38 | Read model | read_model | **New** |
| EN39 | Read model field | read_model_field | **New** |
| EN40 | Query | query | **New** |
| EN41 | Policy | policy | **New**: EN09's reactions and EN10's `reacts_to` |
| EN42 | Domain service | domain_service | **New** (decision 8) |
| EN11 | Use case | use_case | EN11 |
| EN43 | Use case actor | use_case_actor | **New** as an entity: EN11 field 2 |
| EN12 | UC requirement | uc_requirement | EN12 Requirement, renamed |
| EN13 | Pattern | pattern | EN13 |
| EN15 | Pattern setting | pattern_setting | EN15 Setting, renamed |
| EN44 | Setting value | setting_value | **New** as an entity: EN15 field 2 |
| EN14 | Pattern rule | pattern_rule | EN14 |
| EN18 | Flow | flow | EN18, now under one use case |
| EN19 | Flow step | flow_step | EN19 |
| EN20 | View | view | EN20, now with no owner |
| EN45 | View requirement | view_requirement | **New** (decision 16) |
| EN21 | Endpoint | endpoint | EN21, now under its command or query |
| EN46 | API requirement | api_requirement | **New** (decision 16) |
| EN25 | Integration | integration | EN25, now with no owner |
| EN47 | Repository | repository | **New**: EN17 Component's successors (decision 17), one row each to EN61 |
| EN48 | Data model | data_model | **New** |
| EN49 | Table | table | **New** |
| EN50 | Table key | table_key | **New** |
| EN51 | Value type | value_type | **New** |
| EN52 | Predicate | predicate | **New** |
| EN53 | Event type | event_type | **New** |
| EN54 | Projection | projection | **New** |
| EN55 | Command handler | command_handler | **New** |
| EN56 | Query handler | query_handler | **New** |
| EN57 | Event handler | event_handler | **New** |
| EN58 | Service | service | **New** |
| EN59 | UI component | ui_component | **New** |
| EN60 | Endpoint handler | endpoint_handler | **New** |
| EN61 | Adapter | adapter | **New** |
| EN62 | Standard | standard | **New** as an entity: A12 had none |
| EN63 | Standard rule | standard_rule | **New** as an entity |
| EN64 | Constraint test | constraint_test | **New**: EN22 Test's successors (decision 19), one row each to EN74 |
| EN65 | Invariant test | invariant_test | **New** |
| EN66 | Specification test | specification_test | **New** |
| EN67 | Policy test | policy_test | **New** |
| EN68 | Domain service test | domain_service_test | **New** |
| EN69 | Use case test | use_case_test | **New** |
| EN70 | View test | view_test | **New** |
| EN71 | Endpoint test | endpoint_test | **New** |
| EN72 | Flow test | flow_test | **New** |
| EN73 | Integration test | integration_test | **New** |
| EN74 | Pattern rule test | pattern_rule_test | **New** |
| EN23 | Open question | question | EN23 |

68 entities. EN16 Layer, EN17 Component, EN22 Test, EN24 API, EN26 Technical flow and EN27 Technical step go with their kinds.

**Has links.** Each entity is reached from the root by `has_many`, or `has_one` where the child's parent column is unique, following `meta_kind_parent`: for every kind and each parent kind it may sit under, one link from the parent's entity to the kind's entity. So `has_one` runs from a use case to its flow, from a constraint, invariant, specification, policy and flow to their one test, and from each design entity to the one technical entity that implements it (aggregate → repository, entity → data model and table, read model → table and projection, value object → value type, specification → predicate, domain event → event type, command → command handler, query → query handler, policy → event handler, domain service → service, endpoint → endpoint handler, integration → adapter). The kinds with no owner are reached the way their IDs place them: Product `has_many` Value object, View, Integration and UI component, and Domain `has_many` Specification. Parts are reached from their owner: Entity → Entity field, Value object → Value object field, Domain event → Event field, Read model → Read model field, Table → Table key, Command → Command change, Use case → Use case actor, Pattern → Pattern setting, Product kind → Product kind field, Product → Product relation, Use case and Domain → Setting value. The old `has_one` EN01→EN02 becomes `has_many` (a product declares many kinds).

**Many-to-many links between entities** (`raises`, `checks`, `reads`, `selects_by`, `hears`, `calls`, `fulfills`, `invokes`, `happens_in`, `exchanges_with`, `renders`, `follows`, `meets`, `about`, and `has_one`/`has_many` themselves) have no way to be drawn inside one aggregate: `has_one` and `has_many` say ownership, and reference fields point at aggregates only. Each entity's description names its links; see "What the plan doesn't cover", item 1.

### Entity fields

Every entity's fields are its table's stored columns, one field per column, in the table's column order (`describeSchema`), so a table's columns follow from its entity's fields with nothing stored twice:

| Field | Value |
| --- | --- |
| Name | The column's name in words (`domain_id` is Domain, `manual_reason` is Manual reason) |
| Meaning | The column's `COMMENT` |
| Required | The column is `NOT NULL` |
| Column name | The column's name, where it differs from the field's name in lower case with underscores |
| Example | From the Tool Library, where it has one |
| Type | By the column, below |

| Column | Type |
| --- | --- |
| `id`, every parent column (`product_id`, `domain_id`, `aggregate_id` …), `type_value_object_id`, `type_aggregate_id`, `invariant_id`, `target_table_id`, `follower_id`, `pattern_id`, `pattern_rule_test.domain_id` | VO01 Record ID |
| `title` | VO02 Title |
| `statement` | VO03 Statement |
| `position` | VO04 Position |
| `flow_step.path` | VO05 Path |
| `product_kind.name`, `product_kind_field.name`, `product_relation.name`, `pattern_setting.name`, `pattern_rule.setting`, `pattern_rule.applies_when_setting`, `setting_value.setting`, `table.name`, `*.column_name` | VO06 Identifier |
| `domain.subdomain_type` | VO07 Subdomain type |
| `entity.role` | VO08 Entity role |
| `type` on the four field tables | VO09 Basic type |
| `table.storage` | VO10 Table storage |
| `table_key.type` | VO11 Key type |
| `endpoint.method` | VO12 HTTP method |
| `event_type.delivery` | VO13 Event delivery |
| `level`, `state`, `file`, `manual_reason` on the eleven test kinds | VO14 Run by (one field, Run by, its four fields flattened into these columns) |
| `product_kind_field.type` | VO15 Kind field type |
| `product_kind.stage`, `product_kind.parent_kind` (a kind's name) | VO16 Stage for `stage`; VO06 Identifier for `parent_kind` |
| `product_relation.role` | VO17 Relation role |
| `group_name` | VO18 Group name |
| `published`, `in_root_table`, `required`, `obligation`, `applies_when_negated` | yes/no |
| Lists (`table_key.columns`, `flow_test.steps`) | text (a list of texts; see "What the plan doesn't cover", item 2) |
| Every other column (`description`, `notes`, `goal`, `meaning`, `route`, `system`, `file` on technical kinds, `given`, `when`, `then`, `accepts`, `refuses`, `expected_result`, `owner`, `role_name`, `name` on fields and roles, `example`, labels) | text |

The old 94 entity_field rows were summaries ("Stage, folder and obligation", "Has one, has many, refers to"); they go, and the accounting table lists what each summary became. Derived and link "fields" (EN01 Records, EN10 Reacted to by, EN16 Components, EN17 Satisfies and the like) leave the entities: links are relations, and counts are the read models'.

### Value objects and constraints

Product-scoped and provisional (see Conventions). A value type names the file that enforces the value.

| ID | Kind | Title | Statement | Value type file | Source |
| --- | --- | --- | --- | --- | --- |
| LA-VO01 | Value object | Record ID | Names one record across the store. | lathe/schema/002-registry.sql (`record_id`'s CHECK) | **New** as a kind: EN fields "Text in the ID format" |
| LA-VO01-C01 | Constraint | A record ID matches the ID pattern | A record ID MUST match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`. | | DR02's first sentence; its "each kind's convention SHOULD be followed" goes, since `id-prefix` now refuses an ID outside its scope (INV03) |
| LA-VO02 | Value object | Title | A record's name in a few words. | lathe/src/store/rows.ts (`normalizeRow` refuses an empty text) | **New** |
| LA-VO02-C01 | Constraint | A title is not blank | A title MUST NOT be empty or only spaces. | | DR04's "a non-empty title" |
| LA-VO03 | Value object | Statement | A rule or requirement in full. | lathe/src/store/rows.ts | **New** |
| LA-VO03-C01 | Constraint | A statement is not blank | A statement MUST NOT be empty or only spaces. | | **New**: the schema's CHECK on every statement |
| LA-VO03-C02 | Constraint | A statement states its rule with MUST, SHOULD or MAY | A statement SHOULD state its rule in full using MUST, MUST NOT, SHOULD or MAY, under a title that is the rule in a few words. | | UC01-R02 |
| LA-VO04 | Value object | Position | A record's place among its siblings. | lathe/schema/005-use-cases.sql (`CHECK (position >= 1)`) | **New** |
| LA-VO04-C01 | Constraint | A position is a whole number from 1 | A position MUST be a whole number from 1. | | DR15, DR24 and UC06-R02's "whole number" parts; UC05-R03's first half |
| LA-VO05 | Value object | Path | Which path through a flow a step is on, such as main or refused. | lathe/schema/006-interaction-design.sql | **New** |
| LA-VO05-C01 | Constraint | A path is not blank | A path MUST NOT be empty or only spaces. | | DR68, rewritten: `path` is now required, so "main by default" goes, and the schema compares paths exactly (see Findings) |
| LA-VO06 | Value object | Identifier | A name code uses: a kind's, a field's, a relation's or a setting's. | lathe/schema/012-product-kinds.sql (and 005-use-cases.sql for settings) | **New** |
| LA-VO06-C01 | Constraint | An identifier is lower case with underscores | An identifier MUST be lower-case letters, digits and underscores, starting with a letter. | | DR17; DR09's field-name sentence; UC05-R08 |
| LA-VO07 | Value object | Subdomain type | How much modeling a domain deserves. | lathe/schema/004-domain-model.sql (`subdomain_type`) | **New** (decision 6) |
| LA-VO07-C01 | Constraint | A subdomain type is core, supporting or generic | A subdomain type MUST be `core`, `supporting` or `generic`. | | **New** |
| LA-VO08 | Value object | Entity role | Whether an entity is its aggregate's root or a part. | lathe/schema/004-domain-model.sql (`entity_role`) | **New** |
| LA-VO08-C01 | Constraint | An entity's role is root or child | An entity's role MUST be `root` or `child`. | | DR50; UC10-R03 |
| LA-VO09 | Value object | Basic type | A field's type when it is no value object and no reference. | lathe/schema/004-domain-model.sql (`basic_type`) | **New** |
| LA-VO09-C01 | Constraint | A basic type is one of seven | A basic type MUST be text, whole number, decimal, date, time, date and time, or yes/no. | | **New** ("Kept as they are": free-text types go) |
| LA-VO10 | Value object | Table storage | How a table is stored. | lathe/schema/007-technical-specification.sql (`table_storage`) | **New** |
| LA-VO10-C01 | Constraint | A table is stored as a table, a view or a materialized view | A table's storage MUST be `table`, `view` or `materialized view`. | | **New** |
| LA-VO11 | Value object | Key type | What a table key is. | lathe/schema/007-technical-specification.sql (`key_type`) | **New** |
| LA-VO11-C01 | Constraint | A key is primary, unique, foreign or an index | A table key's type MUST be `primary`, `unique`, `foreign` or `index`. | | **New** |
| LA-VO12 | Value object | HTTP method | How an endpoint is called. | lathe/schema/006-interaction-design.sql (`http_method`) | **New** |
| LA-VO12-C01 | Constraint | A method is an HTTP method | An endpoint's method MUST be GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS. | | **New** |
| LA-VO13 | Value object | Event delivery | How an event type reaches what hears it. | lathe/schema/007-technical-specification.sql (`event_delivery`) | **New** (decision 1, the outbox) |
| LA-VO13-C01 | Constraint | An event is delivered in process or by outbox | An event type's delivery MUST be `in process` or `outbox`. | | **New** |
| LA-VO14 | Value object | Run by | How a test runs: its level, its state, and the file that runs it or why it is manual. Fields: Level, State, File (optional), Manual reason (optional). | lathe/schema/008-test-plan.sql (`test_level`, `test_state` and the run by CHECKs) | **New** (decision 21); replaces EN22 field 2 and 3 |
| LA-VO14-C01 | Constraint | A level is one of seven | A run by's level MUST be unit, database, api, contract, e2e-api, e2e-ui or manual. | | **New**; old `test_type` values (unit, integration, component, acceptance, domain_rule) go |
| LA-VO14-C02 | Constraint | A state is automated, manual or not automated yet | A run by's state MUST be `automated`, `manual` or `not automated yet`. | | **New**; old `planned` is `not automated yet` |
| LA-VO14-C03 | Constraint | An automated test names its file | An automated run by MUST name the file that runs it, relative to the repo root. | | DR07's first clause, rewritten |
| LA-VO14-C04 | Constraint | Only a manual test gives a manual reason | A manual run by MUST give its reason, and any other MUST NOT. | | **New** |
| LA-VO15 | Value object | Kind field type | The type of a product kind's field. | lathe/schema/012-product-kinds.sql (`field_type`) | **New** |
| LA-VO15-C01 | Constraint | A kind field is text, integer, boolean or date | A product kind field's type MUST be `text`, `integer`, `boolean` or `date`. | | EN02 field 5's type list |
| LA-VO16 | Value object | Stage | Where a kind is read and colored. | lathe/schema/001-meta.sql (`stage`) | **New** (decision 22) |
| LA-VO16-C01 | Constraint | A stage is one of the five | A stage MUST be domain-model, use-cases, interaction-design, technical-specification or test-plan. | | UC08-R03, rewritten for stages (folders go) |
| LA-VO17 | Value object | Relation role | Whether a relation designs or proves. | lathe/schema/001-meta.sql (`link_role`) | **New** |
| LA-VO17-C01 | Constraint | A relation's role is design or proof | A relation's role, when it has one, MUST be `design` or `proof`. | | DR12's "relation role" |
| LA-VO18 | Value object | Group name | A short heading a long list of requirements or rules is sorted under. | (none: not built; see Findings) | **New** |
| LA-VO18-C01 | Constraint | Groups compare trimmed and in any letter case | Two group names MUST be one group when they are equal trimmed and in any letter case. | | UC13-R06's second sentence |

18 value objects, 23 constraints. Every value object is used by an entity's field (the type table above).

### Invariants

All belong to A1. "Enforced by" says which refusal (store or schema), validation rule or check holds each; the engine step (108) rewrites the checks.

| ID | Title | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- |
| INV01 | A record ID is unique across the store | No two records MAY share an ID, of one kind or of two, in any product the store loads. An ID MUST NOT be reused for another record once used, because tests, code and other records cite it. | `record_id` primary key; the store refuses an ID twice before the database sees it | DR01 |
| INV02 | Every record sits under one parent of a kind it may sit under | A product, a value object, a specification, a view, an integration and a UI component MUST NOT have a parent column. Every other record MUST name exactly one parent, of a kind its kind may sit under: an endpoint its command or its query, a table its entity or its read model, a question its product or a domain. | The parent columns' foreign keys from `meta_kind_parent`, `NOT NULL`, and the exactly-one-of-two CHECKs | DR03, rewritten for kinds with no owner and kinds with two parents; its "following parents MUST NOT lead back" goes (no kind may sit under its own kind) |
| INV03 | A record's ID starts with its scope's ID | A record's ID MUST start with its parent's ID, its domain's ID or its product's ID and a hyphen, as its kind's ID scope says. A record with no owner MUST start with a product's ID, and a specification with a domain's. | `id-prefix` validation | **New** (store-interfaces); replaces DR02's "SHOULD follow the convention" and DR60's ID convention as a rule |
| INV04 | A record has every column its kind requires | A record MUST have a value of the right type for each required column of its kind's table, and no column its table lacks. | The store's row checks and `NOT NULL` | DR04 (its title part → VO02-C01) |
| INV05 | A link joins two records of kinds its relation allows | Every link MUST be a row of its relation's table whose ends are existing records of a pair the relation allows. `about` from a question MAY end at a record of any kind. | Link tables' foreign keys; `relation-pair` validation | DR05, DR06, DR10 |
| INV06 | A link stays inside its product | Every link, and every field typed by a value object or an aggregate, MUST join two records of the same product. An ID of another product in text is plain text, never a link. | `link-crosses-product`, `reference-crosses-product` validations | DR75 |
| INV07 | A domain link stays in its domain, and raises in its aggregate | A `checks`, `reads`, `selects_by` or `calls` link MUST join two records of one domain, and a `raises` link a command and an event of one aggregate. | `link-scope` validation | **New**; replaces DR64 (raised_by inside the event's aggregate) |
| INV08 | A flow step fulfills only its own use case's requirements | A flow step MUST fulfill only UC requirements of the use case its flow belongs to. | `step-fulfills-own-use-case` validation | DR25, rewritten (a step no longer reaches rules, interaction requirements or other use cases) |
| INV09 | A policy hears its own domain's events, or published ones | A policy MUST hear an event of its own domain, or a published event of another. | `policy-hears-published` validation | **New** (decision 5) |
| INV10 | What is one stays one | A use case MUST have at most one flow; a constraint, invariant, specification, policy and flow at most one test; a pattern rule at most one test per domain; a design record at most one technical record, and an entity or read model at most one table; a policy MUST hear exactly one event; a flow step MUST invoke at most one command or query and happen in at most one view. | Unique parent columns; `UNIQUE (pattern_rule_id, domain_id)`; unique `source_id` on `hears`, `invokes` and `happens_in` | **New** (decisions 11, 13, 17, 19) |
| INV11 | A command's recorded exception is another aggregate of its domain | A command change MUST name an aggregate of the command's domain other than the command's own, with its reason. | `command-change-in-domain` validation | **New** (decision 1) |
| INV12 | An aggregate has at most one root | An aggregate MUST NOT have more than one entity whose role is root. One with none is work still to do. | `aggregate-root` validation | DR51, rewritten: no root is a coverage gap now, not a refusal |
| INV13 | An entity has one table at most, in its root's or its own | An entity MUST have at most one table, stored as `table`. A child stored in its root's table MUST NOT have a table of its own, and only a child MAY be. | `entity-table` validation; the `in_root_table` and storage CHECKs | **New** |
| INV14 | A table's keys fit together | A table MUST have at most one primary key, and a foreign key MUST point at a table of its own domain. Only a unique key MAY name an invariant or a condition, and exactly a foreign key names its target table. | `one-primary-key`, `foreign-key-crosses-domain` validations; `table_key` CHECKs | **New** |
| INV15 | A field has exactly one type | A field MUST be typed by exactly one of a basic type, a value object or an aggregate, and a value object's field MUST NOT be typed by its own value object. | The four field tables' CHECKs | **New** ("Kept as they are"); DR55's "a reference may cross aggregates and domains" is now a field typed by another aggregate |
| INV16 | A field's name is unique in its owner | No two fields of one entity, value object, event or read model MAY have the same name, compared trimmed and in any letter case. | `UNIQUE` and the `*_name_folded` unique indexes on the four field tables | DR53; DR65's "one name per event" |
| INV17 | Each capability of a domain has its own position | No two capabilities in one domain MAY have the same position. Capabilities in different domains MAY. | `UNIQUE (domain_id, position)` on `capability` | DR15 (its whole-number part → VO04-C01); UC05-R03 |
| INV18 | A flow's paths are numbered 1, 2, 3 | The steps on each path of a flow MUST each have their own position, and SHOULD run 1, 2, 3 without a gap. Steps on different paths MAY share a position. | `UNIQUE (flow_id, path, position)`; the `step-order` check for a gap | DR24, DR69; UC06-R03; UC13-R03 (DR78's technical step part goes) |
| INV19 | A pattern rule's settings are its pattern's | The setting a pattern rule depends on, and its applies-when setting, MUST be settings of its pattern, and an applies-when condition MUST be given whole or not at all. | `pattern_rule` foreign keys and CHECK | DR18; UC05-R09 |
| INV20 | A follower answers every setting of each pattern it follows | A domain or use case that follows a pattern MUST give a setting value for each of the pattern's settings, a value or not applicable with a reason, and none for a pattern it does not follow. Two followed patterns' settings of one name are answered apart. A pattern with no settings asks nothing. | `setting_value`'s foreign key to its `follows` link; the `pattern-setting-missing` check | DR32; UC05-R06, UC05-R07 |
| INV21 | An automated test's file names its test | An automated test's file MUST exist and MUST contain the test's ID. A technical record's file MAY not exist yet: that shows as not built, not as breakage. | The engine's code scanning (check) | DR07, rewritten: `key` and `key_file` go, and components become technical records |
| INV22 | A product's kind is its own and never widens Lathe's | A product kind MUST be declared once, by a name no Lathe table has, under a kind that exists, and its records MUST sit in the product that declares it. A product MUST NOT widen Lathe's kinds with another parent or more required columns. | `product_kind` primary key; `product-kinds.ts` refusals; `product-kind-product` validation | DR09, DR13, DR14 |
| INV23 | A product relation adds a table or a pair, never changes Lathe's | A product relation with a new name MUST get a link table of its own; one with Lathe's name MAY only add a pair its link table's ends accept and MUST NOT change Lathe's role, labels or description. Each pair is declared once, and every relation MUST have both its labels. | `product_relation` key; `product-kinds.ts` | DR23, DR61, DR62 |
| INV24 | A product's declarations are described | Every product kind, kind field and product relation MUST have a description, so the reference never shows a blank. | `NOT NULL` on the declarations' descriptions | DR58, its product part (its Lathe part → UC03-R07) |
| INV25 | Parts stay inside their aggregate | A `has_one` or `has_many` link MUST join two entities of one aggregate. | The `has-crosses-aggregate` check today (an error); see "What the plan doesn't cover", item 3 | DR54; UC10-R06 |
| INV26 | A domain is named for a capability, not a technology | A domain SHOULD be named for what it does for someone. A title or domain code that holds a technology word as a whole word (web app, frontend, backend, API, UI, server, database, desktop, mobile, engine, infrastructure, Electron and the like) SHOULD be reported as a warning; the description is not read. | The `domain-named-for-technology` check (warning) | DR71, rewritten: "technology as a layer inside its Design stage" becomes "technology through the technical kinds" |
| INV27 | An event is named in the past tense | A domain event's title SHOULD say what happened, subject first and in the past tense. A title with no past form as its last word or after its first SHOULD be reported as a warning. | The `event-tense` check (warning) | DR63 |
| INV28 | Every child entity is reached from its root | Each child entity SHOULD be reached from its aggregate's root by `has_one` or `has_many` links inside the aggregate. One that is not SHOULD be a warning, and an aggregate without exactly one root MUST NOT have its children judged. | The `entity-unreferenced` check (warning) | DR56, DR57 |
| INV29 | A record with no owner is used | A view, integration, value object, specification or UI component that nothing uses MUST be reported as an error. | The engine's "nothing uses it" checks (108) | **New** (plan, "How rules are enforced"); DR82's integration part |
| INV30 | A pattern rule test's domain follows its pattern | A pattern rule test MUST name a domain that follows the rule's pattern, or has a use case that does. | The engine's check (108) | **New** (brief 108) |
| INV31 | A heard or published event is delivered by outbox | An event a policy hears, or a published event, SHOULD have an event type delivered by `outbox`; one that isn't SHOULD be a warning. | The engine's check (108) | **New** (decision 1) |
| INV32 | A test runs at a level its kind allows | A test's run by level SHOULD be one its kind allows; one that isn't SHOULD be a warning. | The engine's check (108), with the allowed levels | **New** (brief 108) |

### Specifications

| ID | Title | Reads | Statement | Source |
| --- | --- | --- | --- | --- |
| SP01 | Record has no owner | A1 | A record has no owner when its kind has no parent column: a value object, specification, view, integration or UI component. | **New**: `store.move`'s refusal ("A record with no owner cannot move") |
| SP02 | Record is referenced | A1 | A record is referenced when a child, a link to it, a field typed by it or a table key naming it points at it. | **New**: `store.remove`'s refusal, which lists up to 20 referrers |
| SP03 | Data files clash | A1 | Two sides of a merge clash on a data file when one key is added on both sides with different content, or one row is changed on both sides, or removed on one and changed on the other. | DR84; UC19-R02 |

### Domain events

Both are published: Platform's live reload hears them (to resolve with LA-PLT). Both are delivered `in process` (see Findings).

| ID | Title | Parent | Raised by | Source |
| --- | --- | --- | --- | --- |
| EV01 | Record changed | A1 | CMD01–CMD08 | EV01; raised_by EV01→EN01. Description keeps "or changed by a merge or a checkout, which the server announces as `spec:changed`". |
| EV03 | Schema changed | A1 | CMD01, CMD02, CMD06 (on a product kind, kind field or relation) | EV03; raised_by EV03→EN02. Description: "A product's declaration of its own kinds and relations changed, through the command layer, or Lathe's migrations changed. The MCP server announces its tools again." |

| Event | # | Name | Type | Source |
| --- | --- | --- | --- | --- |
| EV01 | 1 | Data folder | text | EV01 field 1 ("Folder path.") |
| EV01 | 2 | File | text | field 2 |
| EV01 | 3 | Change | text (`added`, `changed` or `removed`) | field 3 |
| EV01 | 4 | Changed at | date and time | field 4 |
| EV03 | 1 | File | text | EV03 field 1 |
| EV03 | 2 | Product | VO01 Record ID, optional (none for Lathe's schema) | field 2 |
| EV03 | 3 | Changed at | date and time | field 3 |

Meanings carry over. EV03 field 1's example becomes `lathe/schema/004-domain-model.sql` (015-kind-position.sql is gone).

### Commands

The command layer's writes, found in the store and the merge driver. Each changes A1, the product's data, in one transaction.

| ID | Title | Parent | Raises | Checks | Source |
| --- | --- | --- | --- | --- | --- |
| CMD01 | Add a record | A1 | EV01, EV03 | | `store.add`; UC01, UC04. Adds a row to a kind, part, declaration or checking table, with its registry and supertype rows. |
| CMD02 | Change a record | A1 | EV01, EV03 | | `store.set`. Changes or clears columns; keys and parent columns stay. |
| CMD03 | Move a record | A1 | EV01 | SP01 (refuses a record with no owner) | `store.move` |
| CMD04 | Link two records | A1 | EV01 | | `store.link` |
| CMD05 | Unlink two records | A1 | EV01 | | `store.unlink` |
| CMD06 | Remove a record | A1 | EV01, EV03 | SP02 (refuses a referenced record, naming its referrers) | `store.remove`, with its parts and the links it starts |
| CMD07 | Apply several changes as one | A1 | EV01 | | `store.apply`: all or nothing |
| CMD08 | Merge two branches' data | A1 | EV01 | SP03 | `mergeData`, `mergeDataFiles`; UC19 |

No command changes another aggregate, so there are no command changes.

### Read models and fields

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| RM01 | Reference | LA-AUT | A1 | **New** as a kind: API01's Reference shape and `Reference` in `lathe/src/reference.ts` |
| RM02 | Record | LA-AUT | A1 | **New**: what `lathe show` answers (`Shown` in `lathe/src/cli/operations.ts`) |

| Read model | # | Name | Type | Meaning | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Kinds | text | Every kind, Lathe's and the product's, by stage and position, with its label, description, stage, parents and children, obligation, ID pattern, example and scope. | API01 shape 1, `kinds` |
| RM01 | 2 | Tables | text | Each table's role, keys and columns with their types, values, references and descriptions. | `tables` |
| RM01 | 3 | Relations | text | Each relation's role, scope, labels, description and pairs. | `relations` |
| RM01 | 4 | Stages | text | Each stage's position, label and description. | `sections`, rewritten for stages |
| RM01 | 5 | Checks | text | Each check's name, severity, summary, explanation and kinds, Lathe's, the engine's own and the product's. | `checks` |
| RM02 | 1 | ID | VO01 Record ID | The record. | `Shown` |
| RM02 | 2 | Kind | VO06 Identifier | Its kind. | |
| RM02 | 3 | Row | text | Its columns. | |
| RM02 | 4 | Parts | text | Its part rows. | |
| RM02 | 5 | Children | text | The records under it. | |
| RM02 | 6 | Links | text | Its links out and in, by relation. | |
| RM02 | 7 | Data file | text, optional | The data file that holds its row. | C67 |

### Queries

| ID | Title | Parent | Calls | Source |
| --- | --- | --- | --- | --- |
| QRY01 | Get the reference | RM01 | | `buildReference(root)` (C46); E01 |
| QRY02 | Show a record | RM02 | | `show` (C88) |
| QRY03 | List a kind's records | RM02 | | `list` (C88) |
| QRY04 | Suggest the next ID | RM02 | DS01 | `nextId` (C88) |
| QRY05 | Find a record's data file | RM02 | | `findDataFile` (C67) |

None selects by a specification.

### Policies
None. EV03's effect on the MCP tools is the MCP integration's (UC04-FL-S04), not a command; Platform's reload on EV01 and EV03 is Platform's policy (to resolve).

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| DS01 | Next ID | LA-AUT | QRY04 | Works out the next free ID for a record of a kind under a parent: the kind's ID pattern with the parent's, domain's or product's ID put in, then the lowest number no record has. | **New** as a kind: `idShapes` and the numbering in `nextId` |

### Terms

**New**: the old domain has no glossary. Meanings follow the schema's table comments and the plan.

| ID | Term | Meaning |
| --- | --- | --- |
| TM01 | Product | The root of a set of specifications, its own space: its records link only to each other. |
| TM02 | Record | One row of a kind's table, with an ID unique across the store, a title, at most one parent, and its parts and links. |
| TM03 | Kind | A sort of record, with its own table, stage, parents and ID pattern. Lathe has fifty; a product may declare more. |
| TM04 | Stage | One of the five places a kind is read in, in order: domain model, use cases, interaction design, technical specification, test plan. |
| TM05 | Parent | The one record a record sits under, named by one of its kind's parent columns. |
| TM06 | Part | A row a record owns that is no record itself, such as an entity's fields or a table's keys, removed with it. |
| TM07 | Link | A row of a relation's table joining two records of one product. |
| TM08 | Relation | A sort of link, with the pairs of kinds it may join and its words read both ways. |
| TM09 | Obligation | A record that is owed design, build and proof: a constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule or standard rule. |
| TM10 | Designed, built, proved | An obligation's three states: its implementation specified, its technical record naming a file that exists, its test written at a level its kind allows. |
| TM11 | Technical record | The one record of a technical kind that implements a design record, naming its file. |
| TM12 | Run by | How a test runs: a level, a state, and its file or why it is manual. |
| TM13 | Product kind | A kind a product declares for itself, in any stage, under any kind. |
| TM14 | Command layer | The commands every writer uses to change data (add, set, move, link, unlink, remove, apply), each one transaction that the store accepts or refuses whole. |
| TM15 | Data file | `data/<table>.jsonl`: one table's rows, one JSON object per line, sorted by key. The source of truth, reviewed in git. |
| TM16 | Reference | Every kind, table, relation, stage and check of a product, generated from its schema and check rows. |
| TM17 | Refusal | A write the store does not accept, with every reason and no data changed. |
| TM18 | Recorded exception | Another aggregate of its domain that a command also changes in its transaction, named with the reason. |
| TM19 | Pattern | Behavior several use cases share, written once with its rules and settings; each follower answers its settings. |
| TM20 | Standard | Engineering rules the product's code follows, which technical records and tests meet. |

The DDD and CQRS words themselves (aggregate, entity, value object, constraint, invariant, specification, domain event, command, read model, query, policy, domain service) are defined by their kinds' table comments in the reference, and aren't repeated as terms.

## Use cases

### Capabilities

| ID | Title | Parent | Position | Source |
| --- | --- | --- | --- | --- |
| CAP01 | Writing records | LA-AUT | 1 | CAP01, unchanged |
| CAP02 | Adapting Lathe to a product | LA-AUT | 2 | CAP02; description: "The kinds and relations, their stages and order, the reference that shows them, and how a product adds its own." |
| CAP03 | Modeling a domain | LA-AUT | 3 | CAP03 "Structuring a domain", renamed; description: "Domains by capability, and each domain's model: aggregates, entities and value objects, commands and events, rules, read models and queries." |
| CAP04 | Specifying use cases, design and tests | LA-AUT | 4 | **New**: CAP03's use case, flow, layer and test use cases, split off; description: "Use cases in capabilities and patterns, their flows, the views, endpoints and integrations they reach, the technical records that build them, the standards they meet and the tests that prove them." |

### Use cases

Actors are unchanged (Owner and Agent everywhere but UC03 Owner, UC14 Reader). No AUT use case follows a pattern.

| ID | Title | Parent | Goal | Source |
| --- | --- | --- | --- | --- |
| UC01 | Change a product's data through the command layer | CAP01 | As today, with its example list rewritten: "adds or changes a record: an aggregate, a command, a use case and its requirements, a technical record, a test." | UC01 |
| UC02 | Split a product into domains by capability | CAP03 | As today, with "away from technology layers" kept and "technology is a layer" dropped; adds: "Each domain says its subdomain type: core, supporting or generic." | UC02 |
| UC03 | Change Lathe's schema with a migration | CAP02 | As today, with "such as a notes column on tests" dropped and "There are no upgrade migrations: the database is rebuilt from the data files on every load." added. | UC03 |
| UC04 | Declare a product's own kinds and relations | CAP02 | Example rewritten: "such as an entry point for its start-up file"; "in any of the five stages" added. | UC04 |
| UC05 | Organize a domain's use cases into capabilities and patterns | CAP04 | Rewritten: every use case sits under one of its domain's ordered capabilities; flows and tests no longer do (they sit under their use case and what they test). The pattern part is unchanged. "A use case left outside the capabilities" goes. | UC05 |
| UC06 | Write a use case's flow as ordered steps | CAP04 | Rewritten: "writes each use case's one flow as flow_step records on its paths: each step invokes at most one command or query, happens in at most one view, may exchange with integrations, and fulfills requirements of its own use case. The store refuses a repeated position or a requirement of another use case; `lathe check` reports a path that skips a number and a requirement no step fulfills." | UC06 |
| UC07 | Name records in text without linking them | CAP01 | Unchanged | UC07 |
| UC08 | Read each kind's stage and order from the schema | CAP02 | Rewritten from "Read each kind's folder": "reads which stage each kind belongs to and its place in it, from the schema; a product places its own kinds in a stage; every list reads kinds in the schema's one order." | UC08 |
| UC10 | Model each aggregate's entities and value objects | CAP03 | Rewritten: "writes each aggregate's records as entities, at most one root and its child parts, each with fields typed by a basic type, a value object or a reference to an aggregate; value objects with their constraints; parts linked by `has_one` and `has_many`, and other aggregates referenced by ID through fields. `involves`, `refers_to` and rules across aggregates under the domain go." | UC10 |
| UC11 | Read the reference generated from the schema | CAP02 | "folder" becomes "stage"; adds "and what clean architecture's use case is in Lathe (a command handler)". | UC11 |
| UC12 | Model commands, the events they raise and the policies that hear them | CAP03 | Rewritten from "Model the domain events each aggregate raises": "writes each aggregate's commands, each raising events of its aggregate and checking specifications; marks an event published when other domains hear it; puts a policy under the command it invokes, hearing one event; and records, with its reason, another aggregate of the domain a command must change in its transaction." | UC12 |
| UC13 | Write the test plan, one test kind per thing tested | CAP04 | Rewritten from "Write tests, flows and levels as a real product has them": "writes each test as the kind named after what it tests, under that one record, with its run by. A long list of requirements or rules is sorted into groups." `supports`, `key_file`, sub-layers and rules under entities go. | UC13 |
| UC14 | Read how each kind and check works, from where I am | CAP02 | "place" means stage; unchanged otherwise | UC14 |
| UC15 | Open a record's data file from the desktop app | CAP01 | Unchanged | UC15 |
| UC16 | Write the engineering standards the code follows | CAP04 | Rewritten: "...Each technical record or test that follows a rule links to it with `meets`. A standard rule is an obligation, proved by the tests and checks that meet it." "under Shared" becomes "in the technical specification stage". | UC16 |
| UC17 | Write the technical records that build the design | CAP04 | Rewritten from "Write how the system carries out a flow, as a technical flow": "writes how each design record is built as the one technical record that implements it (repository, data model, table, value type, predicate, event type, projection, command handler, query handler, event handler, service, UI component, endpoint handler or adapter), naming its file; a table names its keys and the invariants its unique keys enforce; a product declares its own technical kinds for code that fits none." | UC17 (judgment call 8) |
| UC18 | Write the views, endpoints and integrations a flow reaches | CAP04 | Rewritten from "Group endpoints into APIs and write integrations": "an endpoint sits under the command or query it exposes, reached through it; views and integrations have no owner and exist because steps use them; interaction requirements are view requirements and API requirements." | UC18 |
| UC19 | Merge two branches' data | CAP01 | Unchanged | UC19 |
| UC20 | Sort a domain's rules by what they do | CAP03 | **New**: "writes each rule as what it does: a constraint under the value object it checks, an invariant under the aggregate it holds for, a specification reading the aggregates it judges, which commands check and queries select by, or a policy under the command it invokes, hearing one event." Actors Owner, Agent. | **New** (decision 3) |
| UC21 | Model read models, queries, domain services and terms | CAP03 | **New**: "writes each read model under its domain with its fields, reading the aggregates it spans; each query under the one read model it reads; domain logic that belongs to no entity as a domain service; and the domain's glossary as terms." Actors Owner, Agent. | **New** (decisions 4, 8, 9) |

UC09 Group components into layers goes with layers.

### UC requirements

Kept requirements keep their IDs, titles and statements unless rewritten below. New requirements take numbers after the use case's last old one, so no dropped ID is reused (INV01).

| ID | Title | Change | Source |
| --- | --- | --- | --- |
| UC01-R01 | Each record is one row of its kind's table, one line of its file | unchanged | UC01-R01 |
| UC01-R03 | Line and column order do not change what a data file means | "a record's product, domain, parent and links come only from its columns and its relations' rows" becomes "...from its columns, its ID and its relations' rows" (a record with no owner takes its product from its ID) | UC01-R03 |
| UC01-R04 | A record can point at the code that builds or proves it | "A component" becomes "A technical record", "a test the `file`" becomes "a test its run by's `file`" | UC01-R04 |
| UC01-R05 | Every writer uses the same commands | adds `apply` (several changes as one write) | UC01-R05 |
| UC01-R06 | Commands take their columns from the schema | unchanged | UC01-R06 |
| UC01-R07 | A refused write says every reason and changes nothing | unchanged | UC01-R07 |
| UC01-R08 | The plugin's skills write only through the tools | unchanged | UC01-R08 |
| UC02-R01 | The reference says what a domain is | "whose technology is a layer inside its Design stage" becomes "whose technology is written as the technical records that implement its design" | UC02-R01 |
| UC02-R02 | The modeling skill finds the capabilities first | unchanged | UC02-R02 |
| UC02-R03 | Each domain says its subdomain type | **New**: "Each domain MUST say its subdomain type: core for the product's edge, supporting or generic, which guides how much modeling it deserves." | **New** (decision 6) |
| UC03-R01 | A schema change takes effect on the next load | "A new migration" becomes "A changed migration"; adds "the database is rebuilt from the data files, so there are no upgrade migrations" | UC03-R01 |
| UC03-R02 | Existing data is checked against the changed schema | unchanged | UC03-R02 |
| UC03-R03 | The row types and the reference follow the schema | unchanged | UC03-R03 |
| UC03-R04 | Kinds and relations are the schema, not code | **New** from a rule: DR08's statement | DR08 |
| UC03-R05 | Lathe's schema changes only by a migration | **New** from a rule: DR11's statement | DR11 |
| UC03-R06 | Obligations and link roles come only from the schema | **New** from rules: "Which kinds are obligations (a kind's `obligation`, yes or no) and which relations design or prove them (a relation's role) MUST come only from the schema. Coverage and the checks MUST NOT name a kind or relation of their own." | DR12, DR33 (full, proof and none go: `obligation` is yes or no) |
| UC03-R07 | Every table, column, kind and relation of Lathe's is described | **New** from a rule: "Lathe's tables, columns, kinds and relations MUST each have a description, as comments in its migrations, and every check row its summary and explanation." | DR58, its Lathe part |
| UC04-R01 | A product kind gets a table of its own | unchanged | UC04-R01 |
| UC04-R02 | A product kind keeps its own label, stage and obligation | "stage, folder and obligation" becomes "stage and obligation"; "in any of the five stages, or none" added | UC04-R02 |
| UC04-R03 | A product relation adds a link table or a pair | unchanged | UC04-R03 |
| UC04-R04 | A kind declared twice is refused, naming its file and line | unchanged | UC04-R04 |
| UC05-R01 | Every use case sits under a capability with a whole-number position | Rewritten: "A capability MUST sit under a domain and give its place in a required `position`. Every use case MUST sit under one of its domain's capabilities." | UC05-R01 (its "flow or test MAY sit under a capability" goes) |
| UC05-R02 | A use case under a capability belongs to the capability's domain | "A record under a capability, and every record below it" becomes "A use case, and everything under it" | UC05-R02 |
| UC05-R05 | A pattern sits under the product and use cases or domains follow it | unchanged | UC05-R05 |
| UC05-R10 | A pattern rule is owed by every domain that follows it, and proved per domain | **New** from a rule: "A pattern rule MUST be an obligation of each domain that follows its pattern, or has a use case that does, proved by one pattern rule test per rule and domain." | DR34, rewritten (plan's open question 1, recommended answer) |
| UC06-R01 | A flow belongs to one use case, and its steps reach commands, queries and views | Rewritten: "The schema MUST have one `flow` per use case and `flow_step` under it with a required `position` and `path`; a step MAY fulfill its use case's requirements, invoke a command or query, happen in a view and exchange with integrations." | UC06-R01 |
| UC06-R07 | A requirement no step fulfills is a gap | **New**: "A UC requirement that no step of its use case's flow fulfills MUST be reported as not designed." | **New** (decision 12) |
| UC07-R01 | An ID in text is kept as written and makes no link | adds DR22's "only a row of a relation's table relates two records" | UC07-R01, DR22 |
| UC07-R02 | No check reads text for IDs | unchanged | UC07-R02 |
| UC08-R01 | The engine loads the stages and each kind's stage and position | Rewritten: "The engine MUST load the stages in order and each kind's stage and position from the schema. The product and open questions MUST sit outside the stages." | UC08-R01, DR36 (folders become stages) |
| UC08-R02 | A product places its own kinds in a stage | Rewritten: "A product kind MAY name one of the five stages, or none, and MUST NOT add a stage or change one of Lathe's kinds." | UC08-R02 |
| UC08-R05 | Kinds are read in one order, the schema's | **New** from a rule: DR83's statement, its order rewritten "the product, then stage by stage, each kind by its position, then open questions; then a product's own kinds by name" | DR83 |
| UC10-R01 | Entities, value objects and their fields are in the schema | Rewritten: "The schema MUST have `entity` under an aggregate requiring `role`, `value_object` with no owner and `constraint` under it, the four field tables, and `has_one` and `has_many` from entity to entity. The reference MUST describe them." | UC10-R01 (`refers_to` and `involves` go) |
| UC10-R02 | An entity's fields are its entity_field rows | Rewritten: "...in position order, each with a name, a meaning, exactly one type, whether it is required, and a column name and example when they help. An entity, event or read model with no fields MUST be reported as a gap." | UC10-R02, DR52 |
| UC10-R08 | Another aggregate is referenced by ID, through a field | **New**: "A reference to another aggregate MUST be a field typed by that aggregate: in its own domain its table holds a foreign key, in another domain a plain ID." | **New** (decision 7); DR55 |
| UC11-R01 | The reference script prints the reference, or writes it to a file | "the folders" becomes "the stages" | UC11-R01 |
| UC11-R02 | The reference gives every fact of each kind, table, relation, stage and check | "folder" becomes "stage"; a kind's ID scope and "obligation (yes or no)" added; adds "and says that clean architecture's use case is a command handler in Lathe" | UC11-R02, DR60 |
| UC11-R03 | A product's reference shows its own kinds and its own checks | unchanged | UC11-R03 |
| UC11-R05 | Lathe's committed reference never goes stale | adds DR59's "never written by hand" | UC11-R05, DR59 |
| UC11-R06 | What the reference would leave blank is refused | unchanged | UC11-R06 |
| UC11-R07 | Relations read in plain words from both ends | example labels become "Raises" and "Raised by" | UC11-R07 |
| UC12-R01 | Commands, events and policies are in the schema | Rewritten: "The schema MUST have `domain_event` under an aggregate with `published`, `command` under an aggregate with `raises` and `checks`, `policy` under a command with `hears`, and `command_change` rows. The reference MUST describe them." | UC12-R01 (`raised_by` and `reacts_to` go) |
| UC12-R02 | An event's fields are its event_field rows, as an entity's | "`entity-fields` MUST report an event with no fields" becomes "an event with no fields MUST be reported as a gap" | UC12-R02 |
| UC12-R06 | A command changes one aggregate, or records why not | **New**: "A command MUST change exactly its own aggregate. Another aggregate of its domain it changes in the same transaction MUST be recorded with the reason, and each recorded exception MUST be reported as a warning." | **New** (decision 1) |
| UC13-R06 | Requirements and rules may name a group | "`requirement`, `interaction_requirement`" becomes "`uc_requirement`, `view_requirement`, `api_requirement`"; its comparison sentence → VO18-C01 | UC13-R06 |
| UC13-R07 | Each test sits under what it tests, as that thing's test kind | **New**: "Each test MUST be of the test kind named after what it tests and sit under that one record, which is all it proves." | **New** (decision 19) |
| UC14-R05 | Kinds, problem codes and columns link to their format pages | unchanged | UC14-R05 |
| UC14-R06 | The record format is a command and a link in the shortcuts sheet | unchanged | UC14-R06 |
| UC14-R07 | Quick find finds kinds and checks | unchanged | UC14-R07 |
| UC14-R08 | Every kind and every check has one page, from the product's own data | **New** from rules: DR73's and DR74's statements, joined | DR73, DR74 |
| UC15-R01 | A record's data file can be revealed, opened in the editor and its ID copied | unchanged | UC15-R01 |
| UC15-R02 | Open in editor uses VS Code unless another editor is chosen | unchanged | UC15-R02 |
| UC16-R01 | Standards and meets are in the schema | Rewritten: "...`standard` under the product and `standard_rule` under a standard, in the technical specification stage, and `meets` from a technical record or a test to a standard rule, with no role..." (technical step and component go; Shared goes) | UC16-R01 |
| UC16-R02 | A standard rule is owed, and proved by what meets it | Rewritten (reversed): "A standard rule MUST be an obligation of the product: proved by the tests and checks that meet it, named in their run by. One that nothing meets MUST be reported as not proved." | UC16-R02, UC16-R03, DR76, DR77 (judgment call 10) |
| UC16-R04 | Standards are listed with the technical specification, each listing its rules and what meets them | "in its Shared folder beside its patterns" becomes "in the technical specification stage" | UC16-R04 |
| UC16-R05 | A standard rule shows what meets it | "with no coverage gaps" goes | UC16-R05 |
| UC16-R06 | The graph draws standards with a ruler | "in the product's Shared folder in the Design colors" becomes "in the technical specification stage's color" | UC16-R06 |
| UC17-R07 | Each technical record implements one design record and names its file | **New**: "Each technical record MUST sit under the one design record it implements and name its file, relative to the repo root; a file that does not exist yet is work still to do." | **New** (decision 17) |
| UC17-R08 | A table stores only what fields can't say | **New**: "A table's columns MUST follow from its entity's or read model's fields, with value objects flattened; the table MUST store its name, its storage and its keys, and a unique key MAY name the invariant it enforces." | **New** ("Kept as they are") |
| UC18-R04 | An endpoint exposes one command or query | **New**: "An endpoint MUST sit under the one command or query it exposes, and a flow step MUST reach it through that command or query, never directly." | **New** (decision 14) |
| UC18-R05 | Views and integrations exist because steps use them | **New**: "A view or an integration MUST have no owner, its product following from its ID, and one that no step uses MUST be reported as an error." | **New** (decision 15); DR82 |
| UC18-R06 | Interaction requirements are view or API requirements | **New**: "A rule of the interaction design MUST be a view requirement under its view or an API requirement under its endpoint." | **New** (decision 16) |
| UC19-R01 | Both sides' rows are kept, sorted | unchanged | UC19-R01 |
| UC19-R02 | A real clash fails the merge, naming it | unchanged | UC19-R02 |
| UC19-R03 | The merged table's own rules are checked | unchanged | UC19-R03 |
| UC19-R04 | Git runs the driver for every data file | unchanged | UC19-R04 |
| UC20-R01 | Rules are constraints, invariants, specifications or policies | **New**: "The schema MUST have `constraint` under a value object, `invariant` under an aggregate, `specification` with no owner reading one or more aggregates of one domain, and `policy` under the command it invokes, each with a required statement." | **New** (decision 3) |
| UC20-R02 | Uniqueness is an invariant its unique key enforces | **New**: "A rule that no two records share a value MUST be an invariant, and the unique key that enforces it MUST name it." | **New** (decision 3) |
| UC21-R01 | Read models, queries, domain services and terms are in the schema | **New**: "The schema MUST have `read_model` under a domain with its fields and `reads`, `query` under one read model, `domain_service` under a domain that commands and queries `calls`, and `term` under a domain." | **New** (decisions 4, 8, 9) |

69 UC requirements: 49 kept or rewritten, 7 made from old domain rules, 13 new. The 44 old requirements that go are in the accounting table.

## Interaction design

### Flows

One per use case, belonging only to it (decision 11). Old F03 carried out thirteen use cases and splits.

| ID | Title | Source |
| --- | --- | --- |
| UC01-FL | Change a record through the command layer | F01, its UC01 part |
| UC02-FL | Split a product into domains and check their names | F02 |
| UC03-FL | Change Lathe's schema | F03 step 2's migration part |
| UC04-FL | Declare a product's own kinds | F03 steps 1–3 |
| UC05-FL | Put use cases in capabilities and patterns | F03 step 4 |
| UC06-FL | Write a flow as steps and check it | F04 and its steps |
| UC07-FL | Name records in text | F01, its UC07 part |
| UC08-FL | Read kinds by stage | **New** (F03 carried out UC08 with no step of its own) |
| UC10-FL | Model an aggregate's entities and value objects | **New**, likewise |
| UC11-FL | Read the reference | **New**, likewise |
| UC12-FL | Model commands, events and policies | **New**, likewise |
| UC13-FL | Write the test plan | **New**, likewise |
| UC14-FL | Read a kind's or a check's page | **New**: LA-CHK-F03's steps that reach the format pages (to resolve) |
| UC15-FL | Open a record's file from the desktop app | F05 |
| UC16-FL | Write a standard and meet it | F03 step 4's last sentence |
| UC17-FL | Write the technical records | **New**; replaces F07 |
| UC18-FL | Write a flow's views, endpoints and integrations | F06, rewritten |
| UC19-FL | Merge two branches' data | F08 |
| UC20-FL | Sort a domain's rules | **New** |
| UC21-FL | Model read models, queries, domain services and terms | **New** |

### Flow steps

Steps in full start `LA-AUT-`. A step with no view happens outside the app (the CLI, the MCP tools, git or the editor). Views written `LA-V…` are this sheet's; the record page and the checks page are LA-EXP's views (to resolve).

| ID | Path | Title | Invokes | In view | Exchanges with | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The Agent follows the plugin's skills, which write only through the tools | | | LA-INT01 | UC01-R08 | **New** |
| UC01-FL-S02 | main | The Agent or the Owner adds a record with its typed columns, parent and parts | CMD01 | | LA-INT01 | UC01-R04, UC01-R05, UC01-R06 | F01 step 1 |
| UC01-FL-S03 | main | They change a record's columns | CMD02 | | | UC01-R05 | F01 step 1 |
| UC01-FL-S04 | refused | The command layer refuses a write with every reason, and no data file changes | | | | UC01-R07 | F01 step 2 |
| UC01-FL-S05 | main | The rows the write changed land in the data files, one line each, sorted, for review in git | | | | UC01-R01, UC01-R03 | F01 steps 2–3 |
| UC01-FL-S06 | main | They show the record to see what they wrote | QRY02 | | | UC01-R05 | **New** |
| UC01-FL-S07 | move | They move a record under another parent | CMD03 | | | | **New** |
| UC01-FL-S08 | link | They link or unlink two records | CMD04 | | | | **New** |
| UC01-FL-S09 | link | ...or unlink them | CMD05 | | | | **New** |
| UC01-FL-S10 | remove | They remove a record with its parts | CMD06 | | | | **New** |
| UC01-FL-S11 | several | They make several changes as one write | CMD07 | | | | **New** |
| UC02-FL-S01 | main | The Agent follows the modeling skill's first step and lists the product's business capabilities | | | LA-INT01 | UC02-R02 | F02 step 1 |
| UC02-FL-S02 | main | They read what the reference says a domain is | QRY01 | LA-V04 | | UC02-R01 | F02 step 1 |
| UC02-FL-S03 | main | They add one domain per capability, with its subdomain type | CMD01 | | | UC02-R03 | F02 step 2 |
| UC02-FL-S04 | main | `lathe check` warns of a domain named for a technology, and they rename it for its capability | CMD02 | | | | F02 step 3 |
| UC03-FL-S01 | main | The Owner writes the change into Lathe's migrations and reviews the diff in git | | | | UC03-R04, UC03-R05, UC03-R07 | F03 step 2 |
| UC03-FL-S02 | main | They regenerate the row types and the reference; a test fails while either is stale | QRY01 | | | UC03-R03 | **New** (UC03's goal) |
| UC03-FL-S03 | main | The next load applies the migrations in order and checks every product's data against them | | | | UC03-R01, UC03-R02, UC03-R06 | F03 step 3 |
| UC04-FL-S01 | main | The Owner or the Agent declares a product kind with its fields, in a stage | CMD01 | | | UC04-R01, UC04-R02 | F03 step 2 |
| UC04-FL-S02 | main | They declare product relations, new or adding a pair to Lathe's | CMD01 | | | UC04-R03 | F03 step 2 |
| UC04-FL-S03 | refused | A kind declared twice is refused, naming the file and line of each | | | | UC04-R04 | **New** |
| UC04-FL-S04 | main | The next load generates the product's tables; the MCP server announces its tools again | | | LA-INT01 | | F03 step 3; C89 |
| UC05-FL-S01 | main | They add the domain's capabilities in order | CMD01 | | | UC05-R01 | F03 step 4 |
| UC05-FL-S02 | main | They move each use case under its capability | CMD03 | | | UC05-R02 | F03 step 4 |
| UC05-FL-S03 | main | They write shared behavior once, as a pattern with its rules and settings | CMD01 | | | UC05-R05 | F03 step 4 |
| UC05-FL-S04 | main | Each follower links the pattern and answers its settings; each following domain owes its rules | CMD04 | | | UC05-R05, UC05-R10 | F03 step 4 |
| UC06-FL-S01 | main | They add the use case's flow, and its steps in order on their paths | CMD01 | | | UC06-R01 | F04-S01 |
| UC06-FL-S02 | main | They link each step to the requirements it fulfills, the command or query it invokes and the view it happens in | CMD04 | | | UC06-R01 | F04-S01, F04-S04 |
| UC06-FL-S03 | refused | A repeated position on a path, or a requirement of another use case, is refused | | | | | F04-S02, F04-S03 |
| UC06-FL-S04 | main | `lathe check` reports a path that skips a number and a requirement no step fulfills | | | | UC06-R07 | F04-S04, rewritten |
| UC07-FL-S01 | main | They write a record whose text names other records, in any product's IDs | CMD02 | | | UC07-R01 | F01 step 1 |
| UC07-FL-S02 | main | The record shows its text as written; only its links relate it | QRY02 | | | UC07-R01 | **New** |
| UC07-FL-S03 | main | `lathe check` reports nothing about IDs in text | | | | UC07-R02 | F01 step 3 |
| UC08-FL-S01 | main | They read each kind's stage and place in the reference | QRY01 | LA-V01 | | UC08-R01, UC08-R05 | **New** |
| UC08-FL-S02 | main | They declare a product kind in one of the stages | CMD01 | | | UC08-R02 | **New** |
| UC10-FL-S01 | main | They add the aggregate's root and child entities | CMD01 | | | UC10-R01 | **New** |
| UC10-FL-S02 | main | They add each entity's fields, typed by a basic type, a value object or another aggregate | CMD01 | | | UC10-R02, UC10-R08 | **New** |
| UC10-FL-S03 | main | They add the value objects with their constraints | CMD01 | | | UC10-R01 | **New** |
| UC10-FL-S04 | main | They link parts to the root with `has_one` and `has_many`; `lathe check` reports a child no link reaches | CMD04 | | | UC10-R01 | **New** |
| UC11-FL-S01 | main | They run the reference script and read the reference it writes | QRY01 | LA-V04 | | UC11-R01, UC11-R02, UC11-R05, UC11-R07 | **New** |
| UC11-FL-S02 | main | A product's reference shows its own kinds and checks after Lathe's | QRY01 | LA-V04 | | UC11-R03 | **New** |
| UC11-FL-S03 | refused | A product kind, relation or check that would leave the reference blank is refused | | | | UC11-R06 | **New** |
| UC12-FL-S01 | main | They add the aggregate's commands, and the events each raises with their fields | CMD01 | | | UC12-R01, UC12-R02 | **New** |
| UC12-FL-S02 | main | They link what each command raises and checks, and mark the events other domains hear as published | CMD04 | | | UC12-R01 | **New** |
| UC12-FL-S03 | main | They add a policy under the command it invokes, hearing one event | CMD01 | | | UC12-R01 | **New** |
| UC12-FL-S04 | exception | A command that must change another aggregate of its domain records it, with its reason | CMD01 | | | UC12-R06 | **New** |
| UC13-FL-S01 | main | They add each test under the record it tests, with its run by | CMD01 | | | UC13-R07 | **New** |
| UC13-FL-S02 | main | They sort a long list of requirements or rules into groups | CMD02 | | | UC13-R06 | **New** |
| UC14-FL-S01 | main | The Reader opens the record format from the palette or the shortcuts sheet | QRY01 | LA-V01 | | UC14-R06 | LA-CHK-F03 (to resolve) |
| UC14-FL-S02 | main | They open a kind's page from the side bar's Kind row or a column label | QRY01 | LA-V02 | | UC14-R05, UC14-R08 | LA-CHK-F03 (to resolve) |
| UC14-FL-S03 | main | They open a check's page from a problem's code | QRY01 | LA-V03 | | UC14-R05, UC14-R08 | LA-CHK-F03 (to resolve) |
| UC14-FL-S04 | find | They find a kind or a check by quick find | QRY01 | | | UC14-R07 | **New** |
| UC15-FL-S01 | main | In the desktop app, the author chooses Reveal in Finder, Open in editor or Copy ID for the record in front | | the record page (LA-EXP, to resolve) | | UC15-R01 | F05 step 1 |
| UC15-FL-S02 | main | The shell finds the data file from the ID and reveals it, or opens it in the chosen editor | QRY05 | | LA-INT02, LA-INT03 | UC15-R01, UC15-R02 | F05 step 2 |
| UC15-FL-S03 | main | The author changes the record, and the page reloads with the change | CMD02 | | | | F05 step 3 |
| UC16-FL-S01 | main | They add a standard and its rules | CMD01 | | | UC16-R01 | F03 step 4 |
| UC16-FL-S02 | main | They link each technical record and test that follows a rule with `meets` | CMD04 | | | UC16-R02 | F03 step 4 |
| UC16-FL-S03 | main | They read each standard with its rules and what meets them, in the app and the graph | QRY02 | the record page (LA-EXP, to resolve) | | UC16-R04, UC16-R05, UC16-R06 | **New** |
| UC17-FL-S01 | main | They add the technical record under the design record it implements, naming its file | CMD01 | | | UC17-R07 | **New** (F07 step 1's place) |
| UC17-FL-S02 | main | They add each entity's and read model's table with its keys, a unique key naming its invariant | CMD01 | | | UC17-R08 | **New** |
| UC18-FL-S01 | main | They add an endpoint under the command or query it exposes | CMD01 | | | UC18-R04 | F06 step 1, rewritten |
| UC18-FL-S02 | main | They add view requirements under views and API requirements under endpoints | CMD01 | | | UC18-R06 | F06 step 2, rewritten |
| UC18-FL-S03 | main | They link steps to the views they happen in and the integrations they exchange with; `lathe check` reports one nothing uses | CMD04 | | | UC18-R05 | F06 step 3, rewritten |
| UC19-FL-S01 | main | Git merges two branches and runs the merge driver for each data file | CMD08 | | LA-INT04 | UC19-R01, UC19-R03, UC19-R04 | F08 steps 1–2 |
| UC19-FL-S02 | clash | A real clash stops the merge, naming the key and both versions | | | LA-INT04 | UC19-R02 | F08 step 3 |
| UC20-FL-S01 | main | They add each value format as a constraint of its value object | CMD01 | | | UC20-R01 | **New** |
| UC20-FL-S02 | main | They add each rule of one aggregate as its invariant, naming it on the unique key that enforces it | CMD01 | | | UC20-R01, UC20-R02 | **New** |
| UC20-FL-S03 | main | They add each check across aggregates as a specification, linking what it reads and the commands that check it | CMD04 | | | UC20-R01 | **New** |
| UC21-FL-S01 | main | They add each read model with its fields, linking the aggregates it reads, and its queries | CMD01 | | | UC21-R01 | **New** |
| UC21-FL-S02 | main | They add domain services and the domain's terms | CMD01 | | | UC21-R01 | **New** |

70 steps. Every kept and new UC requirement is fulfilled by at least one step of its own use case's flow.

### Views and view requirements

Product-scoped, provisional numbers. The format pages' page-level requirements move from UC14 to their views, where view tests prove them (judgment call 12).

| ID | Kind | Title | Route or statement | Source |
| --- | --- | --- | --- | --- |
| LA-V01 | View | Format page | `/format`; description as today, "kinds by stage and folder" becomes "kinds by stage" | V01 |
| LA-V01-R01 | View requirement | The format page says how records are kept, then indexes kinds, relations and checks | UC14-R01's statement, "by stage and by folder within each stage" becoming "by stage" | UC14-R01 |
| LA-V01-R02 | View requirement | Format pages open in the workbench, with the side bar showing the facts | UC14-R04's statement; it holds for the kind and check pages too | UC14-R04 |
| LA-V02 | View | Kind page | `/format/kinds/<kind>`, as today | V02 |
| LA-V02-R01 | View requirement | A kind page shows everything the reference says about the kind, with a real example | UC14-R02's statement, "its stage and folder" becoming "its stage", and "its ID scope" added | UC14-R02 |
| LA-V03 | View | Check page | `/format/checks/<check>`, as today | V03 |
| LA-V03-R01 | View requirement | A check page shows its explanation, its query and the problems it reports now | UC14-R03, unchanged | UC14-R03 |
| LA-V04 | View | Reference document | no route: `lathe/REFERENCE.md`, the reference as Markdown, committed so an Agent reads it without running anything | **New**: C47 |

### Endpoints and API requirements

| ID | Kind | Title | Parent | Method and route | Source |
| --- | --- | --- | --- | --- | --- |
| EP01 | Endpoint | Get the reference | QRY01 | GET `/api/reference` | E01. Description adds API01's: "served by `lathe serve`, the desktop app and the app's Vite plugin alike; any other method answers 405", and the Reference and Error shapes (API01's api_shape rows). |
| EP01-R01 | API requirement | GET /api/reference answers with the product's reference as JSON | EP01 | | E01-R01, unchanged |

UC11-R04 "GET /api/reference serves the reference" goes: EP01-R01 says the same under its endpoint.

### Integrations

Product-scoped, provisional numbers.

| ID | Title | System | Source |
| --- | --- | --- | --- |
| LA-INT01 | The Agent's MCP client | Claude Code, through the Lathe plugin, speaking MCP over stdio | **New**: C89, C90 |
| LA-INT02 | File manager | The operating system's file manager (Finder on macOS) and clipboard | **New**: C67's "reveals the file with `shell.showItemInFolder`" |
| LA-INT03 | Code editor | VS Code by default; Cursor, Zed, the system's default app or a command of the Owner's own | **New**: C68 |
| LA-INT04 | Git | Git, which runs `lathe merge-data` for each data file `.gitattributes` names | **New**: UC19-R04, C85 |

## Technical specification

Each record names one file that exists. Kinds with no code are left out and show as not built: event handlers (there are no policies), projections, and RM01's and RM02's tables (they have none: both are answered from the store on each request).

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| A1-REPO | Repository | A1 | lathe/src/store/store.ts | `openStore`, `Store` (load, `rows`, `record`, writes), with `rows.ts` for the data file form and `insert.ts` for loading order | C81, C82 |
| `<entity>`-DM (68) | Data model | each entity | lathe/src/store/tables.ts | its row type, `<Name>Row` (`ProductRow` … `QuestionRow`) | C86 |
| `<entity>`-TB (68) | Table | each entity | its migration (below) | its table | C01, C03, C07, C08, C10, C11, C14, C18, C27, C36, C54, C70 |
| LA-VO01-VT … LA-VO17-VT (17) | Value type | each value object but VO18 | the file in the value objects table | its CHECK, ENUM type or refusal | C91 (field names), C92 (kind order), and **New** |
| SP01-PR | Predicate | SP01 | lathe/src/store/store.ts | `move`'s no-owner refusal | **New** |
| SP02-PR | Predicate | SP02 | lathe/src/store/store.ts | `remove`'s referrer listing | **New** |
| SP03-PR | Predicate | SP03 | lathe/src/store/merge.ts | the clash detection in `mergeData` | C85 |
| EV01-ET | Event type | EV01 | lathe/src/server/api.ts | `watchTargets`: `spec:changed` for the data folder and Lathe's check rows; delivery `in process` | **New** |
| EV03-ET | Event type | EV03 | lathe/src/cli/mcp.ts | the declarations-changed branch that sends `notifications/tools/list_changed`; delivery `in process` | C89 |
| CMD01-H … CMD07-H (7) | Command handler | CMD01 … CMD07 | lathe/src/store/store.ts | `add`, `set`, `move`, `link`, `unlink`, `remove`, `apply`: each builds the new state in one transaction, validates it, then rewrites the files it changed | C81, C84 |
| CMD08-H | Command handler | CMD08 | lathe/src/store/merge.ts | `mergeData`, `mergeDataFiles` | C85 |
| QRY01-H | Query handler | QRY01 | lathe/src/index.ts | `buildReference` | C46 |
| QRY02-H | Query handler | QRY02 | lathe/src/cli/operations.ts | `show` | C88 |
| QRY03-H | Query handler | QRY03 | lathe/src/cli/operations.ts | `list` | C88 |
| QRY04-H | Query handler | QRY04 | lathe/src/cli/operations.ts | `nextId` | C88 |
| QRY05-H | Query handler | QRY05 | desktop/src/records.ts | `findDataFile`, `DataFiles`, `parseRecordRequest`; meets LA-STD-CODE-R03 | C67 |
| DS01-SV | Service | DS01 | lathe/src/cli/operations.ts | `idShapes` (the numbering inside `nextId` reads the store; see Findings) | **New** |
| EP01-H | Endpoint handler | EP01 | lathe/src/server/api.ts | the `/api/reference` route in `handleApi` | C51; implements C51→E01 |
| LA-INT01-AD | Adapter | LA-INT01 | lathe/src/cli/mcp.ts | `lathe mcp`: the tools over stdio; started for the project folder by `plugin/scripts/mcp-server.mjs` | C89, C90 |
| LA-INT02-AD | Adapter | LA-INT02 | desktop/src/main.ts | `shell.showItemInFolder` and the clipboard, on a record action (to resolve with LA-PLT, which owns the desktop shell's main file) | C67 |
| LA-INT03-AD | Adapter | LA-INT03 | desktop/src/editor.ts | `parseSettings`, `editorLaunch`; meets LA-STD-CODE-R03 | C68 |
| LA-INT04-AD | Adapter | LA-INT04 | lathe/bin/lathe.ts | the `merge-data` branch: `%O %A %B %P`, the merge over ours, exit 1 on a clash | C85 |
| LA-UI01 | UI component | renders LA-V01, LA-V02, LA-V03 | app/src/format/FormatPages.tsx | the three format pages | C62; implements C62→V01, V02, V03 |
| LA-UI02 | UI component | renders LA-V01, LA-V02, LA-V03 | app/src/format/reference.ts | the reference built from `/api/spec` and the pages' lookups | C63 |
| LA-UI03 | UI component | renders LA-V04 | lathe/src/reference.ts | `Reference` and `renderReference`: the Markdown with its anchors | C45 |
| LA-UI04 | UI component | renders LA-EXP's record page (to resolve) | app/src/shell/desktopRecord.tsx | `DesktopRecordActions`, the right-click listener, `recordIdAt` | C69 |
| LA-UI05 | UI component | renders LA-EXP's record page (to resolve) | app/src/specs/StandardParts.tsx | a standard's Rules table with what meets each rule | C73 |

### Tables and keys

Every entity's table is Lathe's own schema table, storage `table`, file its migration: `product`, `role` (003-product.sql); `domain`, `aggregate`, `entity`, `value_object`, `constraint`, `invariant`, `specification`, `domain_event`, `command`, `command_change`, `read_model`, `query`, `policy`, `domain_service`, `term` and the four field tables (004-domain-model.sql); `capability`, `use_case`, `use_case_actor`, `uc_requirement`, `pattern`, `pattern_setting`, `pattern_rule` (005-use-cases.sql); `flow`, `flow_step`, `view`, `view_requirement`, `endpoint`, `api_requirement`, `integration` (006-interaction-design.sql); the fourteen technical tables, `standard`, `standard_rule` (007-technical-specification.sql); the eleven test tables (008-test-plan.sql); `question` (009-questions.sql); `setting_value` (010-links.sql); `product_kind`, `product_kind_field`, `product_relation` (012-product-kinds.sql).

Each table's keys are its `PRIMARY KEY`, its parent columns' and type columns' `FOREIGN KEY`s and its `UNIQUE` constraints and indexes, as `describeSchema` reads them; brief 111 writes them from there. The unique keys that enforce an invariant name it:

| Table | Key | Columns | Invariant |
| --- | --- | --- | --- |
| EN04-TB … every kind's table | the parent column, where unique | `<parent>_id` | INV10 |
| EN05-TB `capability` | unique | `domain_id`, `position` | INV17 |
| EN19-TB `flow_step` | unique | `flow_id`, `path`, `position` | INV18 |
| EN07-TB, EN32-TB, EN35-TB, EN39-TB (the field tables) | unique, and the `*_name_folded` index | owner, `lower(trim(name))` | INV16 |
| EN74-TB `pattern_rule_test` | unique | `pattern_rule_id`, `domain_id` | INV10 |
| EN02-TB `product_kind` | primary | `name` | INV22 |

`record_id` (the registry, whose primary key enforces INV01), the supertype tables, the sixteen link tables (010-links.sql) and the meta tables have no entity, and so no table record (see "What the plan doesn't cover", item 1). `product_setting`, `check` and `problem` are LA-CHK's.

### Proposed product kinds

Lathe's command line, its build scripts and its plugin skills fit none of the fourteen technical kinds. Proposed for the Owner's review (decision 18):

| Kind | Label | Stage | Parent kind | ID pattern | Fields | Obligation |
| --- | --- | --- | --- | --- | --- | --- |
| `cli_command` | CLI command | interaction-design | domain | `<P>-<D>-CLI<nn>` | `usage` (text, required: how it is called), `mcp_tool` (text: the MCP tool that does the same, if any) | no |
| `cli_handler` | CLI handler | technical-specification | cli_command | `<cli command>-H` | `file` (text, required) | no |
| `skill` | Skill | interaction-design | domain | `<P>-<D>-SK<nn>` | `file` (text, required) | no |

And one product relation: `exposes`, from `cli_command` to `command` and to `query`, labeled "Exposes" and "Exposed by", no role: a CLI command exposes one command or query, as an endpoint does.

| ID | Kind | Title | Usage / file | Exposes | MCP tool | Source |
| --- | --- | --- | --- | --- | --- | --- |
| CLI01 | CLI command | Add a record | `lathe add <table> --<column> <value>…` | CMD01 | add | C87 |
| CLI02 | CLI command | Change a record | `lathe set <id> --<column> <value>…` | CMD02 | set | C87 |
| CLI03 | CLI command | Move a record | `lathe move <id> --parent <id>` | CMD03 | move | C87 |
| CLI04 | CLI command | Link two records | `lathe link <relation> <source> <target>` | CMD04 | link | C87 |
| CLI05 | CLI command | Unlink two records | `lathe unlink <relation> <source> <target>` | CMD05 | unlink | C87 |
| CLI06 | CLI command | Remove a record | `lathe remove <id>` | CMD06 | remove | C87 |
| CLI07 | CLI command | Show a record | `lathe show <id>` | QRY02 | show | C87 |
| CLI08 | CLI command | List records | `lathe list <table> [--parent <id>]` | QRY03 | list | C87 |
| CLI09 | CLI command | Print the next ID | `lathe next-id <kind> --parent <id>` | QRY04 | next_id | C87 |
| CLI10 | CLI command | Merge a data file | `lathe merge-data %O %A %B %P` | CMD08 | | C85 |
| CLI11 | CLI command | Write the reference | `npm --prefix lathe run reference [-- --print \| --out <file>]` | QRY01 | | C50 |
| CLI12 | CLI command | Generate the row types | `npm --prefix lathe run schema` | QRY01 | | C86 |
| CLI01-H … CLI09-H | CLI handler | | lathe/src/cli/writers.ts (with the shared operations in operations.ts) | | | C87, C88 |
| CLI10-H | CLI handler | | lathe/bin/lathe.ts | | | C85 |
| CLI11-H | CLI handler | | lathe/scripts/reference.ts | | | C50 |
| CLI12-H | CLI handler | | lathe/scripts/schema-types.ts | | | C86 |
| SK01 | Skill | Modeling skill | plugin/skills/model-a-domain/SKILL.md | | | C02 |
| SK02 | Skill | Design skill | plugin/skills/design-the-domain/SKILL.md | | | C79 |

`check` (a check row) is LA-CHK's to propose; Authoring's old check components are accounted for under each invariant's "Enforced by" and in the accounting table.

## Test plan

Every test names one parent and a run by. Levels follow what each test does: a test that opens a store or runs `lathe check` on a fixture is **database** when it proves an invariant, constraint or specification and **api** when it proves a use case requirement (it drives Lathe's package or command interface, which is a toolkit's API); a test that runs the `lathe` command or the MCP server as a process is **api**, or **e2e-api** when it writes a whole spec end to end; the app's and desktop's vitest tests are **unit**. All are automated unless marked. Where several old or new tests prove one record that takes exactly one test, the sheet picks one and lists the rest as duplicates, for the engine step (108) to fold into that test or delete.

**Store tests with no ID yet** (`lathe/test/store/refusals.test.ts`, `commands.test.ts`, `merge.test.ts`) are marked **New (store)**: the test exists and passes; its `it` takes the new ID in its name when brief 111 writes the record.

### Constraint tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-VO01-C01-T | VO01-C01 | database, lathe/test/records.test.ts | T05 |
| LA-VO02-C01-T | VO02-C01 | database, lathe/test/records.test.ts | T07, its title part |
| LA-VO03-C02-T | VO03-C02 | database, lathe/test/records.test.ts | T11 (it reads Lathe's own spec) |
| LA-VO04-C01-T | VO04-C01 | database, lathe/test/capabilities.test.ts | T28 |
| LA-VO06-C01-T | VO06-C01 | database, lathe/test/capabilities.test.ts | T31 |
| LA-VO08-C01-T | VO08-C01 | database, lathe/test/entities.test.ts | T72 |
| LA-VO14-C03-T | VO14-C03 | database, lathe/test/store/refusals.test.ts | **New (store)**: "refuses an automated test with no file…", its first part |
| LA-VO14-C04-T | VO14-C04 | database, lathe/test/store/refusals.test.ts | **New (store)**: the same `it`, its manual-reason parts |
| LA-VO16-C01-T | VO16-C01 | database, lathe/test/sections.test.ts | T59, rewritten: a product kind naming no stage is refused |

Not proved: VO03-C01, VO05-C01, VO07-C01, VO09-C01 to VO13-C01, VO14-C01, VO14-C02, VO15-C01, VO17-C01 (the schema refuses each, but no test names it), and VO18-C01 (LA-EXP-T200 and LA-CHK-T53 show it; to resolve). All run against DuckDB, where Lathe's value types live; see Findings on the allowed level.

### Invariant tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| INV01-T | INV01 | database, lathe/test/store/kinds.test.ts | T147. Duplicates: T04, T14 |
| INV02-T | INV02 | database, lathe/test/records.test.ts | T06. Duplicates: the bad-parent parts of `commands.test.ts` "refuses a row whose key exists, a bad parent…", and `refusals.test.ts` "an endpoint or a table with both parents or neither" and "a question under both" (fold in) |
| INV03-T | INV03 | database, lathe/test/store/refusals.test.ts | **New (store)**: "refuses an ID that does not start with its parent's or domain's ID" and "a record with no owner whose prefix names no product" |
| INV04-T | INV04 | database, lathe/test/store/kinds.test.ts | T149. Duplicate: T07's other parts |
| INV05-T | INV05 | database, lathe/test/records.test.ts | T09. Duplicates: T08, T15, T16, `commands.test.ts`'s link refusals |
| INV06-T | INV06 | database, lathe/test/link-crosses-product.test.ts | LA-CHK-T52 (to resolve). Duplicates: `refusals.test.ts` "a link, or a field reference, across products", `commands.test.ts` "a link to another product" |
| INV07-T | INV07 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a command and a specification in different domains" and "a specification reading another domain's aggregate, and a command raising another aggregate's event" |
| INV08-T | INV08 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a step fulfilling another use case's requirement" |
| INV09-T | INV09 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a policy hearing another domain's unpublished event" |
| INV10-T | INV10 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a policy hearing two events", "a second flow", "a second invariant test… each exactly-one kind", "a second pattern rule test", "a step invoking two operations, or happening in two views" |
| INV11-T | INV11 | database, lathe/test/store/refusals.test.ts | **New (store)**: "records another aggregate of the command's domain…" |
| INV12-T | INV12 | database, lathe/test/store/refusals.test.ts | **New (store)**: "two roots, but not one with none". Duplicate: `commands.test.ts` "refuses an aggregate with two roots" |
| INV13-T | INV13 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a table for an entity stored in its root's table…" |
| INV14-T | INV14 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a table's second primary key…" |
| INV15-T | INV15 | database, lathe/test/store/refusals.test.ts | **New (store)**: "a field with two types, or none" |
| INV16-T | INV16 | database, lathe/test/store/field-names.test.ts | T137. Duplicate: T71 |
| INV17-T | INV17 | database, lathe/test/capabilities.test.ts | T29 |
| INV18-T | INV18 | database, lathe/test/trial-4-fixes.test.ts | T95. Duplicates: T41, T42 |
| INV19-T | INV19 | database, lathe/test/groups-and-waivers.test.ts | T136. Duplicates: T32, `refusals.test.ts`'s pattern rule part |
| INV20-T | INV20 | database, lathe/test/capabilities.test.ts | LA-TRC-T17 (to resolve). Duplicates: LA-TRC-T18, T19, T55, `refusals.test.ts`'s setting value part |
| INV21-T | INV21 | database, lathe/test/checks.test.ts | T17, rewritten for run by. Duplicate: T10 |
| INV22-T | INV22 | database, lathe/test/tests-and-meta.test.ts | T21. Duplicate: T19 |
| INV23-T | INV23 | database, lathe/test/structure.test.ts | T38. Duplicates: T86, LA-CHK-T19 (to resolve) |
| INV24-T | INV24 | database, lathe/test/reference.test.ts | T82 |
| INV25-T | INV25 | database, lathe/test/entities.test.ts | T75 |
| INV26-T | INV26 | database, lathe/test/domain-names.test.ts | T103, T104 and T105, joined |
| INV27-T | INV27 | database, lathe/test/events.test.ts | T93 |
| INV28-T | INV28 | database, lathe/test/entities.test.ts | T76 |

Not proved: INV29 to INV32, whose checks the engine step writes with their tests.

### Specification and domain service tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| SP01-T | SP01 | database, lathe/test/store/commands.test.ts | **New (store)**: "refuses … a record with no owner …", its no-owner part |
| SP02-T | SP02 | database, lathe/test/store/commands.test.ts | **New (store)**: "refuses a record others reference, saying what references it" |
| SP03-T | SP03 | database, lathe/test/store/merge.test.ts | T153 and T154, joined |

DS01 is not proved: `next-id` is tested only through the CLI (UC01-R05-T…), and a domain service test is unit.

### Use case tests

All api, automated, unless marked. IDs in full start `LA-AUT-`.

| ID | Parent | File | Source |
| --- | --- | --- | --- |
| UC01-R01-T01 | UC01-R01 | lathe/test/records.test.ts | T01 |
| UC01-R01-T02 | UC01-R01 | lathe/test/store/files.test.ts | T145 |
| UC01-R01-T03 | UC01-R01 | lathe/test/store/files.test.ts | T146 |
| UC01-R01-T04 | UC01-R01 | lathe/test/store/kinds.test.ts | T148 |
| UC01-R03-T01 | UC01-R03 | lathe/test/records.test.ts | T03 |
| UC01-R03-T02 | UC01-R03 | lathe/test/store/files.test.ts | T144 |
| UC01-R04-T01 | UC01-R04 | lathe/test/records.test.ts | T02, rewritten (technical record and run by) |
| UC01-R05-T01 … T07 | UC01-R05 | lathe/test/cli/writers.test.ts | T158, T162, T163, T164, T165, T166, and **New**: the `it` "lathe show, list and next-id" |
| UC01-R05-T08 | UC01-R05 | lathe/test/cli/mcp.test.ts | T169 |
| UC01-R06-T01 | UC01-R06 | lathe/test/cli/writers.test.ts | T159 |
| UC01-R06-T02 | UC01-R06 | lathe/test/cli/writers.test.ts | T161 |
| UC01-R06-T03 | UC01-R06 | lathe/test/cli/mcp.test.ts | T170 |
| UC01-R07-T01 | UC01-R07 | lathe/test/cli/writers.test.ts | T160 |
| UC01-R07-T02 | UC01-R07 | lathe/test/cli/mcp.test.ts | T171 |
| UC01-R08-T01 | UC01-R08 | lathe/test/cli/plugin.test.ts | T173 (unit) |
| UC01-R08-T02 | UC01-R08 | lathe/test/cli/plugin.test.ts | T174 (unit) |
| UC02-R01-T01 | UC02-R01 | lathe/test/domain-names.test.ts | T12 |
| UC02-R02-T01 | UC02-R02 | lathe/test/domain-names.test.ts | T13 (unit: it reads the skill) |
| UC03-R01-T01 | UC03-R01 | lathe/test/store/schema.test.ts | T139 |
| UC03-R02-T01 | UC03-R02 | lathe/test/engine.test.ts | T18, its existing-data part |
| UC03-R03-T01 | UC03-R03 | lathe/test/store/schema.test.ts | T140 |
| UC03-R04-T01 | UC03-R04 | lathe/test/store/schema.test.ts | T142 |
| UC03-R04-T02 | UC03-R04 | lathe/test/store/schema.test.ts | T143 |
| UC03-R05-T01 | UC03-R05 | lathe/test/serve.test.ts | T20 |
| UC03-R06-T01 | UC03-R06 | lathe/test/patterns-like-s2.test.ts | T56, rewritten (obligation yes or no) |
| UC03-R07-T01 | UC03-R07 | lathe/test/store/schema.test.ts | T141 |
| UC04-R01-T01 | UC04-R01 | lathe/test/engine.test.ts | T18, its product-kind part |
| UC04-R02-T01 | UC04-R02 | lathe/test/tests-and-meta.test.ts | T22 |
| UC04-R03-T01 | UC04-R03 | lathe/test/tests-and-meta.test.ts | T23 |
| UC04-R04-T01 | UC04-R04 | lathe/test/tests-and-meta.test.ts | T24 |
| UC05-R01-T01 | UC05-R01 | lathe/test/capabilities.test.ts | T25, rewritten |
| UC05-R02-T01 | UC05-R02 | lathe/test/capabilities.test.ts | T27 |
| UC05-R05-T01 | UC05-R05 | lathe/test/capabilities.test.ts | T26 |
| UC06-R01-T01 | UC06-R01 | lathe/test/flow-steps.test.ts | T39, rewritten |
| UC06-R01-T02 | UC06-R01 | lathe/test/flow-steps.test.ts | T47, rewritten (a flow of well-formed steps raises no problem) |
| UC07-R01-T01 … T08 | UC07-R01 | lathe/test/mentions.test.ts (T33, T35, T37's text part, T121), lathe/test/citations-by-id.test.ts (T48, T51, T52, T55) | T33, T35, T37, T121, T48, T51, T52, T55 |
| UC07-R02-T01 … T05 | UC07-R02 | lathe/test/mentions.test.ts (T34, T36), lathe/test/citations-by-id.test.ts (T49, T50, T53) | T34, T36, T49, T50, T53 |
| UC08-R01-T01 | UC08-R01 | lathe/test/sections.test.ts | T57, rewritten for stages |
| UC08-R01-T02 | UC08-R01 | lathe/test/sections.test.ts | T61, rewritten for stages |
| UC08-R02-T01 | UC08-R02 | lathe/test/sections.test.ts | T58, rewritten for stages |
| UC08-R05-T01 | UC08-R05 | app/test/typed-index.test.ts | T138 (unit) |
| UC10-R01-T01 | UC10-R01 | lathe/test/entities.test.ts | T69, rewritten |
| UC10-R01-T02 | UC10-R01 | lathe/test/entities.test.ts | T77 (a well-formed model gives no problems) |
| UC10-R02-T01 | UC10-R02 | lathe/test/entities.test.ts | T70. Duplicate: T99 |
| UC10-R02-T02 | UC10-R02 | lathe/test/entities.test.ts | T74, rewritten (no fields is a gap) |
| UC11-R01-T01 | UC11-R01 | lathe/test/reference.test.ts | T81 |
| UC11-R01-T02 | UC11-R01 | lathe/test/reference.test.ts | T84 |
| UC11-R02-T01 | UC11-R02 | lathe/test/reference.test.ts | T78 |
| UC11-R03-T01 | UC11-R03 | lathe/test/reference.test.ts | T79 |
| UC11-R05-T01 | UC11-R05 | lathe/test/reference.test.ts | T80 |
| UC11-R06-T01 | UC11-R06 | lathe/test/reference.test.ts | T83 |
| UC11-R07-T01 | UC11-R07 | lathe/test/reference.test.ts | T87 |
| UC12-R01-T01 | UC12-R01 | lathe/test/events.test.ts | T88, rewritten |
| UC12-R02-T01 | UC12-R02 | lathe/test/events.test.ts | T89 |
| UC12-R02-T02 | UC12-R02 | lathe/test/events.test.ts | T90, rewritten (no fields is a gap) |
| UC14-R05-T01 | UC14-R05 | app/test/format-pages.test.tsx | T113 (unit) |
| UC14-R06-T01 | UC14-R06 | app/test/format-pages.test.tsx | T114 (unit) |
| UC14-R07-T01 | UC14-R07 | app/test/format-pages.test.tsx | T115 (unit) |
| UC14-R08-T01 | UC14-R08 | app/test/format-pages.test.tsx | T116 (unit) |
| UC14-R08-T02 | UC14-R08 | app/test/format-pages.test.tsx | T117 (unit) |
| UC15-R01-T01 | UC15-R01 | desktop/test/records.test.ts | T118 (unit) |
| UC15-R01-T02 | UC15-R01 | app/test/desktop-record.test.tsx | T120 (unit) |
| UC15-R02-T01 | UC15-R02 | desktop/test/editor.test.ts | T119 (unit) |
| UC16-R01-T01 | UC16-R01 | lathe/test/standards.test.ts | T122; meets LA-STD-CODE-R03 |
| UC16-R02-T01 | UC16-R02 | lathe/test/standards.test.ts | T123, rewritten (a standard rule is owed); meets LA-STD-CODE-R03 |
| UC16-R02-T02 | UC16-R02 | lathe/test/standards.test.ts | T124, rewritten (nothing meets it: not proved); meets LA-STD-CODE-R03 |
| UC16-R04-T01 | UC16-R04 | app/test/engineering-standards.test.tsx | T125 (unit) |
| UC16-R04-T02 | UC16-R04 | app/test/engineering-standards.test.tsx | T126 (unit) |
| UC16-R05-T01 | UC16-R05 | app/test/engineering-standards.test.tsx | T127 (unit) |
| UC16-R05-T02 | UC16-R05 | app/test/engineering-standards.test.tsx | T128 (unit) |
| UC16-R06-T01 | UC16-R06 | app/test/engineering-standards.test.tsx | T129 (unit) |
| UC19-R01-T01 | UC19-R01 | lathe/test/store/merge.test.ts | T150 |
| UC19-R01-T02 | UC19-R01 | lathe/test/store/merge.test.ts | T151 |
| UC19-R01-T03 | UC19-R01 | lathe/test/store/merge.test.ts | T152 |
| UC19-R02-T01 | UC19-R02 | lathe/test/store/merge.test.ts | T157 |
| UC19-R03-T01 | UC19-R03 | lathe/test/store/merge.test.ts | T155 |
| UC19-R04-T01 | UC19-R04 | lathe/test/store/merge.test.ts | T156 |

Not proved: UC02-R03, UC05-R10 (LA-TRC-T58 and T64 come close; to resolve), UC06-R07, UC10-R08, UC12-R06, UC13-R06 (LA-EXP-T200; to resolve), UC13-R07, UC17-R07, UC17-R08, UC18-R04 to R06, UC20-R01, UC20-R02, UC21-R01.

### View tests

All unit, app/test/format-pages.test.tsx.

| ID | Parent | Source |
| --- | --- | --- |
| LA-V01-R01-T01 | LA-V01-R01 | T110 |
| LA-V01-R02-T01 | LA-V01-R02 | T111, its workbench part |
| LA-V02-R01-T01 | LA-V02-R01 | T111 |
| LA-V03-R01-T01 | LA-V03-R01 | T112 |

### Endpoint tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| EP01-R01-T01 | EP01-R01 | api, lathe/test/reference.test.ts | T85 |

### Flow tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| UC01-FL-T | UC01-FL | e2e-api, lathe/test/cli/end-to-end.test.ts | T167 (a spec written end to end with the `lathe` command) |

The other nineteen flows have no flow test: not proved.

### Integration tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-INT01-T01 | LA-INT01 | e2e-api, lathe/test/cli/end-to-end.test.ts | T168 (a spec written end to end with the MCP tools, as the plugin starts them) |
| LA-INT01-T02 | LA-INT01 | contract, lathe/test/cli/mcp.test.ts | T172 (initialize, tools/list and tools/call over stdio) |
| LA-INT01-T03 | LA-INT01 | e2e-api, lathe/test/cli/plugin.test.ts | T175 (the launcher starts the repo's own `lathe mcp`) |
| LA-INT04-T01 | LA-INT04 | e2e-api, lathe/test/store/merge.test.ts | **New (store)**: "merges two branches that each added a row, through git with the driver set up as the README says" |

### Pattern rule tests
None: no Authoring test proves a pattern rule.

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Domain | 1 | Repository | 1 |
| Aggregate | 1 | Data model | 68 |
| Entity | 68 | Table | 68 |
| Entity field | one per stored column (from the schema) | Table key | from the schema; 6 kinds of unique key name invariants |
| Value object | 18 | Value type | 17 |
| Value object field | 4 (VO14) | Predicate | 3 |
| Constraint | 23 | Event type | 2 |
| Invariant | 32 | Projection | 0 |
| Specification | 3 | Command handler | 8 |
| Domain event | 2 | Query handler | 5 |
| Event field | 7 | Event handler | 0 |
| Command | 8 | Service | 1 |
| Command change | 0 | UI component | 5 |
| Read model | 2 | Endpoint handler | 1 |
| Read model field | 12 | Adapter | 4 |
| Query | 5 | CLI command (proposed) | 12 |
| Policy | 0 | CLI handler (proposed) | 12 |
| Domain service | 1 | Skill (proposed) | 2 |
| Term | 20 | Constraint test | 9 (2 new from store tests) |
| Capability | 4 | Invariant test | 28 (10 new from store tests, 2 to resolve) |
| Use case | 20 | Specification test | 3 (2 new from store tests) |
| Use case actor | 38 | Domain service test | 0 |
| UC requirement | 69 | Use case test | 94 (1 new) |
| Flow | 20 | View test | 4 |
| Flow step | 70 | Endpoint test | 1 |
| View | 4 | Flow test | 1 |
| View requirement | 4 | Integration test | 4 (1 new) |
| Endpoint | 1 | Pattern rule test | 0 |
| API requirement | 1 | Integration | 4 |

144 tests in all: 126 records from 127 of the 175 old tests (T18 and T111 split; T103 to T105 and T153 with T154 joined), 2 claimed from other domains (LA-CHK-T52, LA-TRC-T17; to resolve), and 16 from tests that exist and pass but carry no ID yet (15 store tests and one CLI test). Of the other 48 old tests, 47 are dropped as duplicates or with removed kinds and checks, and T54 goes to LA-PLT. Tests marked "rewritten" stay where they are and are changed by the engine step to the new behavior. Use case actors: UC01 to UC19 keep theirs (36, less UC09's 2) and UC20 and UC21 add Owner and Agent each.

## Judgment calls

1. **One aggregate, A1 Product, holds every kind as an entity.** Decision 1 makes an aggregate the consistency boundary, and in Lathe that boundary is a product's whole data: the store checks each write against all of it in one transaction (cross-record refusals like `step-fulfills-own-use-case`, `link-crosses-product` and one ID across the store), keeps each kind in one file across the product, and the merge driver merges by file. The old fifteen concept aggregates were not boundaries: the command layer's generic commands change any of them, so keeping them would need a recorded exception from every command to every aggregate (about a hundred, each a warning). The cost is one large ERD, which is the meta-model diagram itself. The alternative, for the Owner: keep concept aggregates (Domain, Aggregate, Use case…) as views of the model and accept the recorded exceptions.
2. **Entity descriptions are their tables' comments,** and entity fields are their tables' columns, by rule, so the meta-model is written once (in the migrations) and the spec can't drift from it. Brief 111 generates them.
3. **Rules sorted by what they do.** Value formats became constraints (ID pattern, title, statement, position, path, identifier, the enums, run by). Rules the store, a validation or a check holds for the product's records became invariants of A1. SHOULD rules reported as warnings (`domain-named-for-technology`, `event-tense`, `entity-unreferenced`) stay invariants worded with SHOULD, since a warning check, not a command, holds them; making them specifications would need a query of Authoring to select by them, and the checks are Checking's. Preconditions a command checks before acting (no owner, referenced, merge clash) became specifications.
4. **Rules about Lathe's code and the schema's shape, not about records** (DR08, DR11, DR12, DR33, DR58's Lathe part, DR59, DR60, DR73, DR74, DR83) became UC requirements of UC03, UC08, UC11 and UC14, where the Owner or the Reader meets them.
5. **UC requirements that only restated an invariant or constraint go** (UC05-R03, R04, R06–R09, UC06-R02–R06, UC10-R03–R07, UC12-R03–R05, UC13-R03, UC08-R03, UC11-R04), each mapped to the rule that now holds it, so one rule isn't owed and proved twice.
6. **New requirement numbers follow each use case's last old one** (UC05-R10, UC17-R07), so a dropped ID is never reused with another meaning (INV01).
7. **Old checks retired with their kinds and relations:** `use-case-outside-capability` (a use case's parent is a capability), `layer-order`, `component-outside-layer`, `section-stage-mismatch`, `domain-rule-involves`, `raised-by-outside-aggregate` (now `link-scope`), `flow-step-fulfills-outside-flow` (now `step-fulfills-own-use-case`), `flow-fulfills-differs-from-steps` (flows fulfill nothing), `design-flow-deepens-nothing`, `event-unheard` (an event is defined by the command that raises it; an event no command raises is a gap), `standard-rule-unmet` (now coverage), `entity-fields` (now a gap). Kept, as their invariants' checks: `domain-named-for-technology`, `event-tense`, `entity-unreferenced`, `has-crosses-aggregate`, `step-order`, `pattern-setting-missing`.
8. **UC09 (layers) goes; UC17 (technical flows) becomes the use case for technical records,** the closest role in the new model. F07 and the technical flow kinds go.
9. **UC18 becomes the interaction design use case** (endpoints under their operation, views and integrations with no owner, view and API requirements); APIs and API shapes go, folded into EP01's description as the Tool Library did.
10. **Standard rules are now owed** (the plan lists them as obligations), reversing DR76 and DR77. UC16-R02 says so, and T123 and T124 are rewritten to it.
11. **Lathe's own commands are the command layer's** (add, set, move, link, unlink, remove, apply, merge-data); loading, the reference and `show`, `list`, `next-id` are queries. A schema migration is no command: the Owner edits a file, and the next load reads it.
12. **The format pages' requirements move to view requirements** under their views (LA-V01 to LA-V03), because the app's tests that prove them are component tests at unit level, which view tests allow and use case tests don't. UC14 keeps the requirements about reaching the pages from elsewhere.
13. **Four integrations are new:** the Agent's MCP client, the file manager, the code editor and git. Each is an outside system Lathe exchanges with today.
14. **Four UI components are Authoring's;** the other app files the old components named (`parts.tsx`, `QuickFind.tsx`, `commands.tsx`, `graph/panel.tsx`) are LA-EXP's and LA-PLT's code, so their UI components are theirs (to resolve).
15. **Three product kinds are proposed** (CLI command, CLI handler, skill) and one relation (`exposes`); schema migrations need no kind, since each entity's Table record names its migration, and an invariant's enforcement needs none, since the engine counts it built through its aggregate's data models and unique keys.
16. **Tests that prove a removed kind or check are dropped,** not rewritten (layers, folders, involves, technical flows, APIs, flow fulfills, path folding). The engine step deletes them.
17. **Domain events stay published and in process,** which INV31 will warn of; the data files are the durable record, so a lost notification costs only a reload.
18. **LA-AUT's subdomain type is core:** writing a product down in one typed language is Lathe's edge.

## Rewrites
Records written for the new model rather than moved, with what changed:
- **Domain LA-AUT**: description (layers, flows, "each concept is an aggregate" go).
- **A1 Product**: now the one consistency boundary (call 1). A2–A15 fold into entities.
- **EN09 Domain rule → Invariant; EN07 Field → Entity field; EN12 Requirement → UC requirement; EN15 Setting → Pattern setting**; every kept entity's description becomes its table's comment.
- **DR rules** → constraints, invariants and specifications as listed; DR03 (kinds with no owner, two parents), DR07 (run by), DR25 (own use case), DR51 (at most one root), DR68 (path required), DR71 (technology through technical kinds), DR76/DR77 (standard rules owed) change meaning.
- **Use cases** UC02, UC03, UC04, UC05, UC06, UC08, UC10, UC11, UC12, UC13, UC16, UC17, UC18: goals rewritten as listed.
- **UC requirements**: the rewritten rows above.
- **Flows**: one per use case; F03 split thirteen ways, F04's steps reshaped, F06 and F07 rewritten.
- **Views** V01–V03 → LA-V01–V03 (no owner); **endpoint** E01 → EP01 under QRY01; **E01-R01** → EP01-R01.
- **Event fields**: free-text types become basic types and value objects.
- **Components** → technical records, product kinds or other domains, as listed.
- **Tests**: rewritten in place where marked; T104/T105 and T153/T154 joined; T18, T110/T111 split.

## Findings in the code
- **Path comparison:** DR68 said paths compare trimmed and in any letter case, and steps default to main. The new `flow_step` makes `path` required and its unique key compares it exactly, so `Main` and `main` are two paths. Either the schema folds it (a `lower(trim(path))` unique index, as the field names have) or the rule is gone; the sheet takes it as gone.
- **Group names** (VO18) are compared in any case by the engine and app, but no single function does it: not built.
- **DS01's numbering reads the store** inside `nextId`; only `idShapes` is pure. Extracting the numbering into a pure function would let DS01-SV name it and a unit test prove it.
- **The app builds its own reference** from `/api/spec` (`app/src/format/reference.ts`) rather than calling `GET /api/reference`; the two can drift.
- **No event code by name:** EV01 is the server's file watch (`spec:changed`), EV03 the MCP server's declarations check. Neither is an event type by name.
- **Many lathe/test files test removed kinds** (layers.test.ts, sections.test.ts' folder tests, domain-rule-involves.test.ts, apis-and-design-flows.test.ts, trial-4-fixes.test.ts' sub-layer and rule-under-entity tests): the engine step deletes them.
- **Run by levels against the engine's allowed list** (brief 108): Lathe's value types are SQL CHECKs and ENUMs, so its constraint tests run against DuckDB (database), where constraint tests allow unit only (8 warnings); its use case tests of the app and desktop and of the plugin's skills are unit (19 warnings); its one flow test runs end to end through the CLI (e2e-api), where flow tests allow e2e-ui or manual. Recommendation: allow database for constraint tests and e2e-api for flow tests, since a toolkit's end-to-end path is its command line.

## What the plan doesn't cover
1. **Links between entities of one aggregate, and link tables.** An ERD can say ownership (`has_one`, `has_many`) and references to other aggregates (fields), but not a many-to-many link between two entities of one aggregate (a command raises events, a step invokes a query). And a link table has no kind: Lathe's sixteen link tables, its registry and supertype tables, and any product's join tables can't be traced as Table records. Suggested: let a Table sit under a relation (product kinds can't, since relations aren't records), or accept them as untraced.
2. **List-valued columns** (`table_key.columns`, `flow_test.steps`) have no basic type; they're typed text here. A "list of text" basic type would say it.
3. **`has_one` and `has_many` have scope `product`,** so a part outside its aggregate is held by a check (INV25), not refused. Scope `aggregate` on both would make it a refusal and retire `has-crosses-aggregate`.
4. **SHOULD rules held by warnings** fit none of the four rule kinds exactly; they're invariants here (call 3).
5. **Specifications and checks across domains:** a check is Checking's, but `selects_by` is domain-scoped, so a check can't select by another domain's specification. If checks become queries of LA-CHK, Authoring's warning rules can't be specifications.
6. **The level of a test of a product's command line**: see Findings.

## Cross-domain links to resolve

| From (this sheet) | To | What to settle |
| --- | --- | --- |
| EV01, EV03 published | LA-PLT-A1, LA-PLT-C09 (old `reacts_to`) | Platform's policy or read model that reloads on them |
| UC14-FL steps | LA-CHK-F03 (carried out UC14; uses V02, V03; fulfills UC14-R03, R05) | CHK's sheet drops those parts |
| UC02-FL-S04, UC05-FL, UC10-FL-S04 | the check run (`lathe check`) | the LA-CHK query a step would invoke |
| UC15-FL-S01, UC16-FL-S03, LA-UI04, LA-UI05 | LA-EXP's record page view | the view's new ID |
| LA-INT02-AD | desktop/src/main.ts | LA-PLT owns the file; settle whose adapter it is |
| INV06-T | LA-CHK-T52 | claimed here as INV06's test |
| INV20-T | LA-TRC-T17 (and T18, T19, T55) | claimed here as INV20's test |
| INV23-T duplicate | LA-CHK-T19 | |
| VO18-C01, UC13-R06 | LA-CHK-T53, LA-EXP-T200 | which proves the group rule |
| UC03-R06 | LA-TRC-T04, T06, T59 (proved DR12, DR33) | TRC's coverage tests |
| UC05-R10 | LA-TRC-T58, T64 (proved DR34) | |
| — | LA-TRC-T62, T63 (proved DR35) | DR35 is dropped; TRC drops or rewrites them |
| — | LA-CHK-T12 (proved DR22) | now UC07-R01's; CHK's sheet decides |
| — | LA-PLT-T126 (UC15-R02), LA-PLT-T128 (UC15-R01) | UC15's tests here are T118–T120; PLT's sheet decides |
| T54 | LA-PLT-UC02-R02 | T54 proves only Platform's requirement; it goes to LA-PLT |
| T113's other target | LA-CHK-DR27 | CHK's sheet |
| T118's other target | LA-PLT-DR38 | PLT's sheet |
| T120's other targets | LA-CHK-UC07-R02, LA-PLT-UC15-R12 | |
| T14–T17's other target | LA-CHK-UC01-R04, LA-TRC-UC03-R01 | |
| T32's other target | LA-TRC-UC04-R06 | |
| T42's other target | LA-CHK-DR12 | |
| T56's other targets | LA-TRC-UC07-R04, R06 | |
| T82, T83's other target | LA-CHK-DR26 | |
| F04-S03 fulfilled LA-CHK-DR12 | | dropped with the old step |
| F03 carried out LA-CHK-UC04, LA-CHK-UC06, LA-TRC-UC07 | | those use cases' own flows |
| C05 `lathe/src/config.ts` | LA-PLT (`lathe.config.json`, LA-PLT-UC02) | Platform's technical record |
| C39 `readRecords` parts | LA-PLT (the workspace load) or LA-EXP | whose query handler |
| C64 `app/src/specs/parts.tsx`, C65 `QuickFind.tsx`, C74 `graph/panel.tsx` | LA-EXP | their UI components |
| C66 `app/src/shell/commands.tsx` | LA-PLT | its UI component |
| C46 depends on LA-CHK-C12; reacts_to LA-CHK-EV01 | | dropped (follows from the tree) |
| Other domains' `satisfies` into AUT (20 rows: LA-CHK-C02, C12, C20, LA-EXP-C71, LA-PLT-C01, C03 …) | | dropped: obligations are built by their own technical records |
| Other domains' `applies` into AUT rules (LA-CHK-UC01 → DR01, DR05, DR06 …) | | dropped, as applies goes |
| relates_to LA-AUT-A1 ↔ LA-CHK-A1, LA-EXP-A1, LA-PLT-A1 | | fields typed `→ LA-AUT-A1` in those domains, where they keep a record ID |
| Check rows' `meets` (C57, C72 → LA-STD-CODE-R01) | LA-CHK's check kind | |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| domain LA-AUT | 1 | LA-AUT, subdomain core, description rewritten |
| aggregate A1 | 1 | A1, rewritten (call 1) |
| aggregate A2–A15 | 14 | folded into A1 as entities: A2 → EN04, EN05; A3 → EN06–EN10; A4 → EN11, EN12; A5 → EN13–EN15; A6 → dropped (layers); A7 → EN18, EN19; A8 → EN20; A9 → EN21; A10 → the eleven test entities; A11 → EN23; A12 → EN62, EN63; A13 → EN25; A14 → dropped (technical flows); A15 → dropped (APIs) |
| entity EN01–EN15, EN18–EN21, EN23, EN25 | 21 | kept, four renamed (Entities above) |
| entity EN16 Layer, EN17 Component, EN22 Test, EN24 API, EN26 Technical flow, EN27 Technical step | 6 | dropped with their kinds; EN17 → EN47–EN61, EN22 → EN64–EN74 |
| entity_field | 94 | replaced by one field per stored column (call 2). Summary fields of kept entities → those columns; link and derived "fields" (EN01 Records, Settings; EN04 Follows; EN06 Relates to; EN08 Has one…; EN10 Raised by, Reacted to by; EN11 Applies, Follows; EN16 all; EN17 Satisfies; EN18 Carries out, Uses; EN19 Uses, Fulfills; EN20 Fulfills; EN21 API, Fulfills; EN22 Proves and supports, File and key; EN23 About; EN24 all; EN25 Exchanges; EN26, EN27 all) → relations or dropped with their kinds; EN01 Settings → LA-CHK's product_setting |
| domain_event EV01, EV03 | 2 | EV01, EV03 |
| event_field | 7 | 7 event fields, retyped |
| domain_rule DR01–DR07 | 7 | INV01; VO01-C01; INV02; INV04 + VO02-C01; INV05; INV05; INV21 + VO14-C03 |
| domain_rule DR08, DR11, DR12, DR33 | 4 | UC03-R04, UC03-R05, UC03-R06, UC03-R06 |
| domain_rule DR09, DR13, DR14 | 3 | INV22 (DR09's field-name part → VO06-C01) |
| domain_rule DR10 | 1 | INV05 |
| domain_rule DR15 | 1 | INV17 + VO04-C01 |
| domain_rule DR16 | 1 | dropped: a use case's parent is a capability (INV02) |
| domain_rule DR17 | 1 | VO06-C01 |
| domain_rule DR18 | 1 | INV19 |
| domain_rule DR22 | 1 | UC07-R01 |
| domain_rule DR23, DR61, DR62 | 3 | INV23 |
| domain_rule DR24, DR69 | 2 | INV18 |
| domain_rule DR25 | 1 | INV08 |
| domain_rule DR26 | 1 | dropped: flows fulfill nothing |
| domain_rule DR32 | 1 | INV20 |
| domain_rule DR34 | 1 | UC05-R10 |
| domain_rule DR35 | 1 | dropped: steps fulfill only UC requirements |
| domain_rule DR36 | 1 | UC08-R01 (folders become stages) |
| domain_rule DR37, DR38, DR39 | 3 | dropped: folders go (DR37's enum part → VO16-C01) |
| domain_rule DR40–DR49 | 10 | dropped: layers go |
| domain_rule DR50 | 1 | VO08-C01 |
| domain_rule DR51 | 1 | INV12 |
| domain_rule DR52 | 1 | UC10-R02 |
| domain_rule DR53 | 1 | INV16 |
| domain_rule DR54 | 1 | INV25 |
| domain_rule DR55 | 1 | INV15 and UC10-R08 (references by field) |
| domain_rule DR56, DR57 | 2 | INV28 |
| domain_rule DR58 | 1 | INV24 (product part), UC03-R07 (Lathe part) |
| domain_rule DR59 | 1 | UC11-R05 |
| domain_rule DR60 | 1 | UC11-R02; INV03 |
| domain_rule DR63 | 1 | INV27 |
| domain_rule DR64 | 1 | INV07 |
| domain_rule DR65 | 1 | INV16, UC12-R02 |
| domain_rule DR66, DR67 | 2 | dropped: `reacts_to` goes; policies hear events (INV09); an event no command raises is a gap |
| domain_rule DR68 | 1 | VO05-C01 |
| domain_rule DR70, DR72 | 2 | dropped: rules under entities and `involves` go |
| domain_rule DR71 | 1 | INV26 |
| domain_rule DR73, DR74 | 2 | UC14-R08 |
| domain_rule DR75 | 1 | INV06 |
| domain_rule DR76, DR77 | 2 | UC16-R02, reversed |
| domain_rule DR78–DR80 | 3 | dropped: technical flows go |
| domain_rule DR81 | 1 | dropped: APIs go |
| domain_rule DR82 | 1 | UC18-R05, INV29 |
| domain_rule DR83 | 1 | UC08-R05 |
| domain_rule DR84 | 1 | SP03 |
| capability CAP01–CAP03 | 3 | CAP01–CAP03 (CAP03 renamed); CAP04 new |
| use_case UC01–UC08, UC10–UC19 | 18 | kept, goals rewritten as listed |
| use_case UC09 | 1 | dropped: layers go |
| use_case_actor | 36 | 34 kept; UC09's 2 dropped |
| requirement UC01-R01, R03–R08 | 7 | kept (R03, R04, R05 rewritten) |
| requirement UC01-R02 | 1 | VO03-C02 |
| requirement UC02-R01, R02 | 2 | kept |
| requirement UC03-R01–R03 | 3 | kept |
| requirement UC04-R01–R04 | 4 | kept (R02 rewritten) |
| requirement UC05-R01, R02, R05 | 3 | kept, rewritten |
| requirement UC05-R03 | 1 | INV17, VO04-C01 |
| requirement UC05-R04 | 1 | dropped: a use case always sits under a capability |
| requirement UC05-R06, R07 | 2 | INV20 |
| requirement UC05-R08 | 1 | VO06-C01 |
| requirement UC05-R09 | 1 | INV19 |
| requirement UC06-R01 | 1 | kept, rewritten |
| requirement UC06-R02 | 1 | VO04-C01 |
| requirement UC06-R03 | 1 | INV18 |
| requirement UC06-R04 | 1 | INV08 |
| requirement UC06-R05, R06 | 2 | dropped: flows fulfill nothing |
| requirement UC07-R01, R02 | 2 | kept |
| requirement UC08-R01, R02 | 2 | kept, rewritten for stages |
| requirement UC08-R03 | 1 | VO16-C01 |
| requirement UC08-R04 | 1 | dropped: folders go |
| requirement UC09-R01–R05 | 5 | dropped: layers go |
| requirement UC10-R01, R02 | 2 | kept, rewritten |
| requirement UC10-R03 | 1 | VO08-C01 |
| requirement UC10-R04 | 1 | INV12 |
| requirement UC10-R05 | 1 | INV15, INV16; its "no fields" part → UC10-R02 |
| requirement UC10-R06 | 1 | INV25 |
| requirement UC10-R07 | 1 | INV28 |
| requirement UC11-R01–R03, R05–R07 | 6 | kept (R01, R02, R07 rewritten) |
| requirement UC11-R04 | 1 | EP01-R01 |
| requirement UC12-R01, R02 | 2 | kept, rewritten |
| requirement UC12-R03 | 1 | INV07 |
| requirement UC12-R04 | 1 | dropped: `event-unheard` is retired |
| requirement UC12-R05 | 1 | INV27 |
| requirement UC13-R03 | 1 | INV18, VO05-C01 |
| requirement UC13-R05 | 1 | dropped: rules under entities and sub-layers go |
| requirement UC13-R06 | 1 | kept, rewritten; comparison → VO18-C01 |
| requirement UC14-R01–R04 | 4 | LA-V01-R01, LA-V02-R01, LA-V03-R01, LA-V01-R02 |
| requirement UC14-R05–R07 | 3 | kept |
| requirement UC15-R01, R02 | 2 | kept |
| requirement UC16-R01, R02, R04–R06 | 5 | kept, rewritten |
| requirement UC16-R03 | 1 | UC16-R02 |
| requirement UC17-R01–R06 | 6 | dropped: technical flows go |
| requirement UC18-R01–R03 | 3 | dropped: APIs and integrations and interaction requirements under a domain go |
| requirement UC19-R01–R04 | 4 | kept |
| flow F01 | 1 | UC01-FL and UC07-FL |
| flow F02 | 1 | UC02-FL |
| flow F03 | 1 | UC03-, UC04-, UC05-, UC16-FL; UC08, UC10–UC13 get new flows |
| flow F04 | 1 | UC06-FL |
| flow F05 | 1 | UC15-FL |
| flow F06 | 1 | UC18-FL, rewritten |
| flow F07 | 1 | dropped: technical flows go; UC17-FL is new |
| flow F08 | 1 | UC19-FL |
| flow_step F04-S01–S04 | 4 | UC06-FL-S01–S04 |
| view V01–V03 | 3 | LA-V01–LA-V03 |
| endpoint E01 | 1 | EP01 |
| api API01 | 1 | dropped: the API grouping goes; its description → EP01 |
| api_shape (API01) | 2 | folded into EP01's description; Reference → RM01's fields |
| interaction_requirement E01-R01 | 1 | EP01-R01 |
| layer LAY01–LAY10 | 10 | dropped: layers go |
| component C01, C03, C07, C08, C10, C11, C14, C18, C27, C36, C54, C70 | 12 | the entities' Tables, naming their migrations (C07's folder part dropped) |
| component C02, C79 | 2 | SK01, SK02 (proposed kind) |
| component C04, C12 | 2 | Tables of nothing: link tables (What the plan doesn't cover, item 1); described under A1-REPO's links |
| component C05 | 1 | LA-PLT (to resolve) |
| component C06 | 1 | INV22's and INV23's enforcement (`product-kinds.ts`, named in their "Enforced by") |
| component C09, C30, C32, C33, C35, C61, C77 | 7 | dropped: retired checks and layer-blind coverage |
| component C13, C84 | 2 | INV03's and the validations' enforcement (`validation.ts`); CMD01–CMD07-H's validation step |
| component C19, C42, C43, C44, C57, C58, C59, C60, C72, C20, C21, C26 | 12 | check rows: C19 → INV18, C26 → INV20, C43 → INV25, C44 → INV28, C58 → INV27, C60 → INV26 (each its "Enforced by"); C20, C21, C42, C57, C59, C72 retired (call 7) |
| component C28, C29, C31 | 3 | dropped: folders and layers go |
| component C39 | 1 | LA-PLT or LA-EXP (to resolve) |
| component C41 | 1 | INV12's enforcement (`aggregate-root`) |
| component C45 | 1 | LA-UI03 |
| component C46 | 1 | QRY01-H |
| component C47 | 1 | LA-V04 |
| component C50 | 1 | CLI11-H |
| component C51 | 1 | EP01-H |
| component C62, C63 | 2 | LA-UI01, LA-UI02 |
| component C64, C65, C74 | 3 | LA-EXP (to resolve) |
| component C66 | 1 | LA-PLT (to resolve) |
| component C67 | 1 | QRY05-H; its reveal → LA-INT02-AD |
| component C68 | 1 | LA-INT03-AD |
| component C69 | 1 | LA-UI04 |
| component C73 | 1 | LA-UI05 |
| component C75, C76 | 2 | dropped: APIs, interaction requirements under six kinds and technical flows go |
| component C81, C82 | 2 | A1-REPO; CMD01–CMD07-H |
| component C83 | 1 | dropped as a record: `schema.ts` loads the meta tables; named in UC03's flow (see What the plan doesn't cover, item 1) |
| component C85 | 1 | CMD08-H, SP03-PR, CLI10-H, LA-INT04-AD |
| component C86 | 1 | the Data models; CLI12-H |
| component C87, C88 | 2 | CLI01-H–CLI09-H; QRY02-H–QRY04-H; DS01-SV |
| component C89, C90 | 2 | LA-INT01-AD; EV03-ET |
| component C91, C92 | 2 | VO value types and INV16's folded indexes (their migrations are folded into 004 and 001) |
| test T01–T175 | 175 | Test plan above; dropped: T04, T08, T10, T14, T15, T16, T19, T30 (use case outside capability), T32, T40, T41, T42, T43, T44, T45, T46 (retired flow checks), T60 (section-stage-mismatch), T62–T68 (layers), T73 (no-root refusal goes), T86, T94 (path default), T96, T97, T98, T99, T100, T101, T102 (rules under entities, sub-layers), T104, T105, T153, T154 (joined), T71 (duplicate), T91, T92 (retired event checks), T106–T109 (involves), T130–T135 (APIs, technical flows); to other domains: T54 (LA-PLT) |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many (AUT entities) | 12 | re-derived from the parent tree (Has links above); EN16→EN17, EN26→EN27 dropped |
| has_one EN01→EN02 | 1 | has_many EN01→EN02 |
| refers_to (6) | 6 | EN04→EN01, EN06→EN04, EN10→EN08 → has_many from the parent; EN11→EN03 → the use case actor's role (a foreign key); EN21→EN24, EN26→EN18 dropped with their kinds |
| relates_to (11) | 11 | A3, A6, A7, A14, A15 rows dropped with the aggregates; A1↔LA-CHK/EXP/PLT-A1 → to resolve (fields typed → A1) |
| raised_by EV01→EN01, EV03→EN02 | 2 | raised by CMD01–CMD08 and CMD01, CMD02, CMD06 |
| reacts_to (6) | 6 | C46→EV03, C46→LA-CHK-EV01 dropped; LA-PLT-A1 and LA-PLT-C09 → EV01, EV03: LA-PLT's (to resolve) |
| involves (14) | 14 | dropped: rules across aggregates are specifications |
| applies (102) | 102 | dropped: a use case changes nothing; its steps invoke commands, which keep the invariants and check the specifications |
| carries_out (22) | 22 | each flow's parent; F01's and F03's rows split into one flow per use case; LA-CHK-F03→UC14 → UC14-FL (to resolve); F03→LA-CHK-UC04, UC06, LA-TRC-UC07 → theirs |
| fulfills flow→requirement or rule (F01, F02, F05, F08) | 14 | moved to the new steps (Flow steps above); F02→DR71 dropped (INV26 is held by its check) |
| fulfills step→requirement or rule (F04-S01–S04) | 10 | UC06-FL steps; →DR24, DR25, DR26, LA-CHK-DR12 dropped |
| fulfills view→requirement (V01–V03) | 6 | dropped: the steps fulfilling them happen in the views; UC14-R01–R04 are view requirements |
| fulfills E01, E01-R01→UC11-R04 | 2 | dropped: UC11-R04 → EP01-R01 |
| fulfills LA-CHK-F03→UC14-R03, R05 | 2 | UC14-FL-S02, S03 (to resolve) |
| uses (7) | 7 | F04-S01–S04→C18, C20, C21 dropped; LA-CHK-DF01-S01→C05 and LA-CHK-F03→V02, V03 are LA-CHK's (to resolve) |
| implements C51→E01 | 1 | EP01-H |
| implements C62→V01, V02, V03 | 3 | LA-UI01 renders LA-V01–V03 |
| depends_on (29) | 29 | dropped: handlers using the repository and data models follow from the tree |
| satisfies from AUT components | 234 | replaced by the technical record implementing each obligation's design kind |
| satisfies into AUT from other domains | 20 | dropped (Cross-domain links) |
| meets C57, C72→LA-STD-CODE-R01 | 2 | to resolve with LA-CHK's check kind |
| meets C67→LA-STD-CODE-R03 | 1 | QRY05-H meets R03 |
| meets T122, T123, T124→LA-STD-CODE-R03 | 3 | UC16-R01-T01, UC16-R02-T01, UC16-R02-T02 meet R03 |
| proves from AUT tests | 305 | each new test's parent (Test plan above); proofs of other domains' records → Cross-domain links |
| proves into AUT from other domains | 18 | Cross-domain links |
