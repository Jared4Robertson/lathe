# Lathe reference

Lathe keeps a product's spec as typed rows: a table per kind of record, with typed columns and real keys, so data
that breaks the model cannot be saved. Each stored table is one file, `data/<table>.jsonl`, with one JSON object
per line, sorted by key. Every record has exactly one parent, a foreign key such as a UC requirement's
`use_case_id`, except the kinds with no owner (value objects, specifications, views, integrations and UI
components), which exist because other records use them. Other relationships are links, a row of their relation's
table, and an ID is unique across every kind. Every write is one command of the aggregate it changes, such as Add a
flow step (`lathe use-case add-flow-step`, the plugin's `use_case_add_flow_step` tool, or
`POST /api/use-case/add-flow-step` from the app): it checks the aggregate's rules in one transaction and rewrites the
lines it changed, or is refused with every reason; git is the history. Each aggregate reads through its own queries.

The model is drawn from domain-driven design, CQRS and event storming, in six stages: discovery (the business
outcomes the product exists to achieve), the domain model, use cases on top of it, their interaction design, the
technical records that implement each design record, and the test plan. Links run from what is defined first to
what is defined later. A capability names the outcomes it serves, so the trace runs from an outcome to its
capabilities, their use cases, the code and the tests. An outcome names what measures it (`measured_by`): a test,
or a record of a product's own kind such as a report, or it says how it is measured outside the code.

**Words.** What clean architecture calls a use case or an interactor is what Lathe calls a command handler
(`command_handler`): the application service that carries out one command. A Lathe use case (`use_case`) is the
actor's goal, one level up: its flows' steps, one flow per interface it happens through, invoke commands and queries.

**Checks** are rows of the `check` table. Each holds the query that finds its problems: a SELECT over the tables
returning `severity`, `record` and `message` for each problem. An error means the data is broken; a warning is
something to look at. Lathe's own checks are in `lathe/data/check.jsonl`, loaded beside every product's data; a
product adds its own as rows of its `data/check.jsonl` with its `product_id`. What the schema enforces is never a
check: the store refuses it.

**Coverage** counts every obligation as designed, built and proved, per domain and for the product outside every
domain, and lists as gaps each obligation still short of one, and each record short of a minimum the schema leaves to
it (an "at least one" or "exactly one" that is missing while records are written stage by stage). An obligation is
proved by a test of it, automated or manual, at a run by level its test kind allows, whose file (when automated)
exists and names the test's ID. An obligation something outside the product provides (`provided_by`) is built and
proved through its provider.

**Complexity.** Every kind says whether its records are essential complexity, what the problem itself demands and
the product decides once (discovery, the domain model, use cases and patterns, the what of interaction design), or
accidental complexity, what comes from the means used to build it (the technical specification); a test follows what
it proves, and a standard its type (a quality is essential, engineering accidental). An accidental record is derived
(a tooling record `generates` it), provided (`provided_by`), or a fill: written by hand at a pattern's slot
(`fills`), serving an essential record. Coverage lists each fill as accidental debt.

<!-- Generated from the schema, the check rows and the coverage rules by `npm --prefix lathe run reference`. Do not edit it by hand. -->

<a id="stage-discovery"></a>

## Discovery

The business outcomes the product exists to achieve, each a measurable statement with its measure and target, which its capabilities serve.

<a id="kind-business_outcome"></a>

### Business outcome (`business_outcome`)

A business outcome: a measurable change the product exists to bring about, which its capabilities serve and its tests or records measure (measured_by). The trace runs from it to a capability, a use case, the code and the tests.

- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-BO<nn>`, such as `TL-BO01`; it starts with its parent's ID
- **Links out:** Measured by ([`measured_by`](#relation-measured_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Served by ([`serves`](#relation-serves))
- **Checks:** [`outcome-target-undated`](#check-outcome-target-undated)
- **Gaps:** [`outcome-not-served`](#gap-outcome-not-served), [`outcome-not-measured`](#gap-outcome-not-measured)

<a id="table-business_outcome"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The outcome's ID: its product's ID and BO<nn>, such as TL-BO01. |
| `title` | VARCHAR | yes | The outcome in a few words, such as More tools in use. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `statement` | VARCHAR | yes | The outcome, stated so it can be measured, in one sentence. |
| `measure` | VARCHAR | yes | What is measured to know whether it is reached, and how. |
| `target` | VARCHAR | yes | The value of the measure that counts as reached, and by when. |
| `measured_outside` | VARCHAR | no | How the outcome is measured outside the code, when no test or record of the product can measure it (adoption by other repos, sales): who counts what, from where. Give it only then; an outcome the code can measure links what measures it with measured_by. |
| `notes` | VARCHAR | no | Longer notes, such as where the measure comes from. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`
- **Rule:** `("trim"(measure) != '')`
- **Rule:** `("trim"("target") != '')`
- **Rule:** `("trim"(measured_outside) != '')`

### Checks: discovery

<a id="check-outcome-target-undated"></a>

### `outcome-target-undated`

**Warning** · Lathe's · Kinds: [`business_outcome`](#kind-business_outcome)

A business outcome whose target says no date by which it is reached.

An outcome is a change someone would miss, with a measure and a target by a date (LA-STD-MODELING-R13): without a date the target can never be missed, so it measures nothing. The target says by when, as a year (by 2027) or a span from a known event (within six months of the first release, by the end of the first year). Give the target its date with the Business outcome's change command.

### Coverage gaps: discovery

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-outcome-not-served"></a>`outcome-not-served` | [`business_outcome`](#kind-business_outcome), [`capability`](#kind-capability) | A business outcome no capability serves. |
| <a id="gap-outcome-not-measured"></a>`outcome-not-measured` | [`business_outcome`](#kind-business_outcome) | A business outcome no running test or record measures, and that names no measure outside the code. |

<a id="stage-domain-model"></a>

## Domain model

Domains and their aggregates, entities, value objects, rules (constraints, invariants, specifications and policies), events, commands, read models, queries, domain services and glossary terms.

<a id="kind-domain"></a>

### Domain (`domain`)

A part of the product with its own model, language and owner, for one business capability: what DDD calls a bounded context. Domains meet only through published events.

- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`aggregate`](#kind-aggregate), [`read_model`](#kind-read_model), [`domain_service`](#kind-domain_service), [`term`](#kind-term), [`capability`](#kind-capability), [`data_store`](#kind-data_store), [`repository`](#kind-repository), [`table`](#kind-table), [`entry_point`](#kind-entry_point), [`tooling`](#kind-tooling), [`test_data_set`](#kind-test_data_set), [`question`](#kind-question)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>`, such as `TL-LEND`; it starts with its parent's ID
- **Links out:** Follows ([`follows`](#relation-follows))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`pattern-rule-test-outside-followers`](#check-pattern-rule-test-outside-followers), [`pattern-not-followed`](#check-pattern-not-followed), [`domain-named-for-technology`](#check-domain-named-for-technology)
- **Gaps:** [`domain-without-aggregate`](#gap-domain-without-aggregate)

<a id="table-domain"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The domain's ID: the product prefix and the domain code, such as TL-LEND. |
| `title` | VARCHAR | yes | The domain's name, such as Lending. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `subdomain_type` | ENUM('core', 'supporting', 'generic') | yes | core: the product's edge; supporting: needed for the core but not its edge; generic: solved the same way everywhere. It guides how much modeling the domain deserves. |
| `description` | VARCHAR | yes | What the domain covers, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes on the domain. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-aggregate"></a>

### Aggregate (`aggregate`)

The consistency boundary: a cluster of entities changed together as one unit, by one command at a time. Other aggregates follow its changes through events, and refer to it by ID only.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`entity`](#kind-entity), [`invariant`](#kind-invariant), [`domain_event`](#kind-domain_event), [`storage_requirement`](#kind-storage_requirement)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-A<n>`, such as `TL-LEND-A1`; it starts with its domain's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Persisted by ([`persists`](#relation-persists)), Read by ([`reads`](#relation-reads))
- **Checks:** [`aggregate-too-large`](#check-aggregate-too-large), [`serves-no-outcome`](#check-serves-no-outcome)
- **Gaps:** [`aggregate-without-root`](#gap-aggregate-without-root), [`aggregate-without-command`](#gap-aggregate-without-command), [`aggregate-without-repository`](#gap-aggregate-without-repository)

<a id="table-aggregate"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The aggregate's ID, such as TL-LEND-A1. |
| `title` | VARCHAR | yes | The aggregate's name, such as Loan. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `description` | VARCHAR | yes | What the aggregate keeps and why its entities change together, in a paragraph. |
| `identity` | VARCHAR | yes | What identifies one of its records in the business, such as Loan ID. |
| `notes` | VARCHAR | no | Longer notes on the aggregate. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `("trim"("identity") != '')`

<a id="kind-entity"></a>

### Entity (`entity`)

A record the domain keeps, with an identity: its aggregate's root or one of its children. Its fields are entity_field rows; the value objects it has are the ones its fields are typed with.

- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`)
- **Children:** [`command`](#kind-command), [`data_model`](#kind-data_model), [`table`](#kind-table)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-EN<nn>`, such as `TL-LEND-EN01`; it starts with its domain's ID
- **Links out:** Has many ([`has_many`](#relation-has_many)), Has one ([`has_one`](#relation-has_one))
- **Links in:** Questions about this ([`about`](#relation-about)), Part of ([`has_many`](#relation-has_many)), Part of ([`has_one`](#relation-has_one))
- **Parts:** [`entity_field`](#table-entity_field)
- **Checks:** [`entity-unreferenced`](#check-entity-unreferenced), [`aggregate-too-large`](#check-aggregate-too-large)
- **Gaps:** [`entity-without-fields`](#gap-entity-without-fields), [`entity-without-data-model`](#gap-entity-without-data-model), [`entity-without-table`](#gap-entity-without-table)

<a id="table-entity"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The entity's ID, such as TL-LEND-EN01. |
| `title` | VARCHAR | yes | The entity's name, such as Return. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | yes | The aggregate it belongs to. |
| `role` | ENUM('root', 'child') | yes | root: the record the aggregate is named for, at most one per aggregate; child: one of its parts. |
| `in_root_table` | BOOLEAN | no | true: a child entity with no table of its own, stored in its aggregate root's table (which then holds its fields as columns); left out otherwise. An entity has at most one table. |
| `description` | VARCHAR | yes | What the entity is, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `in_root_table`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `((in_root_table IS NULL) OR ("role" = 'child'))`

<a id="table-entity_field"></a>

#### `entity_field`

One field of an entity, in order. Its table's columns follow from it.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `entity_id` | VARCHAR → [`entity`](#table-entity) | yes | The entity. |
| `position` | INTEGER | yes | The field's place in the entity, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Returned at: one name in its entity, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | ENUM('text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no') | no | Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. |
| `type_value_object_id` | VARCHAR → [`value_object`](#table-value_object) | no | The value object that is its type, if one. |
| `type_aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | no | The aggregate it refers to by ID, if one. A reference within the domain is a foreign key of the entity's table; one to another domain stays a plain ID. |
| `required` | BOOLEAN | yes | true: every record gives it a value; false: it may be empty. |
| `column_name` | VARCHAR | no | Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `entity_id`, `position`
- **Unique:** `entity_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `(((CAST(("type" IS NOT NULL) AS INTEGER) + CAST((type_value_object_id IS NOT NULL) AS INTEGER)) + CAST((type_aggregate_id IS NOT NULL) AS INTEGER)) = 1)`

<a id="kind-value_object"></a>

### Value object (`value_object`)

A value with no identity of its own, such as an email address or a money amount, defined by its fields and checked by its constraints when it is created. It has no owner: it exists because entities, events or read models use it as a field's type, and its product follows from its ID.

- **Parents:** none (no owner: it exists because other records use it)
- **Children:** [`constraint`](#kind-constraint), [`value_type`](#kind-value_type)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-VO<nn>`, such as `TL-VO01`; it starts with its product's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`value_object_field`](#table-value_object_field)
- **Checks:** [`value-object-unused`](#check-value-object-unused)
- **Gaps:** [`value-object-without-fields`](#gap-value-object-without-fields), [`value-object-without-value-type`](#gap-value-object-without-value-type)

<a id="table-value_object"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The value object's ID: the product prefix and VO<nn>, such as TL-VO01. |
| `title` | VARCHAR | yes | The value object's name, such as Email address. |
| `description` | VARCHAR | yes | What the value is, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-value_object_field"></a>

#### `value_object_field`

One field of a value object, in order. A table flattens a value object's fields into columns.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `value_object_id` | VARCHAR → [`value_object`](#table-value_object) | yes | The value object. |
| `position` | INTEGER | yes | The field's place in the value object, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Amount: one name in its value object, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | ENUM('text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no') | no | Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. |
| `type_value_object_id` | VARCHAR → [`value_object`](#table-value_object) | no | Another value object that is its type, if one. |
| `type_aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | no | The aggregate it refers to by ID, if one. |
| `required` | BOOLEAN | yes | true: every record gives it a value; false: it may be empty. |
| `column_name` | VARCHAR | no | Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `value_object_id`, `position`
- **Unique:** `value_object_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `(((CAST(("type" IS NOT NULL) AS INTEGER) + CAST((type_value_object_id IS NOT NULL) AS INTEGER)) + CAST((type_aggregate_id IS NOT NULL) AS INTEGER)) = 1)`
- **Rule:** `((type_value_object_id IS NULL) OR (type_value_object_id != value_object_id))`

<a id="kind-constraint"></a>

### Constraint (`constraint`)

A value object's own rule, checked when the value is created, such as an email address having one @.

- **Parents:** [`value_object`](#kind-value_object) (`value_object_id`)
- **Children:** [`constraint_test`](#kind-constraint_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its value object.
  - **Built:** Its value object's value type names a file that exists.
  - **Proved:** Its constraint test.
- **ID:** `<value object>-C<nn>`, such as `TL-VO01-C01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-constraint"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The constraint's ID: its value object's ID and C<nn>, such as TL-VO01-C01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `value_object_id` | VARCHAR → [`value_object`](#table-value_object) | yes | The value object it belongs to. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-invariant"></a>

### Invariant (`invariant`)

A rule that holds for one aggregate on every change, enforced by its rule (rule) in the aggregate's code. Uniqueness across records (no two members share an email) is an invariant too, which a unique key of the table may back up.

- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`)
- **Children:** [`rule`](#kind-rule), [`invariant_test`](#kind-invariant_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its aggregate.
  - **Built:** Its rule names a file that exists.
  - **Proved:** Its invariant test.
- **ID:** `<P>-<D>-INV<nn>`, such as `TL-LEND-INV01`; it starts with its domain's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-invariant"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The invariant's ID, such as TL-LEND-INV01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | yes | The aggregate it holds for. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-specification"></a>

### Specification (`specification`)

A named predicate over one or more aggregates of one domain (Evans), such as Member in good standing. Commands check it before acting, and queries may select by it. It has no owner: it reads its aggregates, and its domain follows from its ID.

- **Parents:** none (no owner: it exists because other records use it)
- **Children:** [`predicate`](#kind-predicate), [`specification_test`](#kind-specification_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction.
  - **Built:** Its predicate names a file that exists.
  - **Proved:** Its specification test.
- **ID:** `<P>-<D>-SP<nn>`, such as `TL-LEND-SP01`; it starts with its domain's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by)), Reads ([`reads`](#relation-reads))
- **Links in:** Questions about this ([`about`](#relation-about)), Checked by ([`checks`](#relation-checks)), Selects for ([`selects_by`](#relation-selects_by))
- **Checks:** [`specification-unused`](#check-specification-unused), [`specification-title-article`](#check-specification-title-article), [`serves-no-outcome`](#check-serves-no-outcome)
- **Gaps:** [`specification-reads-nothing`](#gap-specification-reads-nothing)

<a id="table-specification"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The specification's ID: its domain's ID and SP<nn>, such as TL-LEND-SP01. |
| `title` | VARCHAR | yes | The predicate's name, such as Member in good standing. |
| `statement` | VARCHAR | yes | When a record satisfies it, in a sentence. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-domain_event"></a>

### Domain event (`domain_event`)

An unchangeable record that something happened to an aggregate, named in the past tense (Loan opened), raised by its commands. What it carries are event_field rows.

- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`)
- **Children:** [`event_type`](#kind-event_type)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-EV<nn>`, such as `TL-LEND-EV01`; it starts with its domain's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Feeds ([`fed_by`](#relation-fed_by)), Heard by ([`hears`](#relation-hears)), Raised by ([`raises`](#relation-raises))
- **Parts:** [`event_field`](#table-event_field)
- **Checks:** [`event-not-by-outbox`](#check-event-not-by-outbox), [`event-tense`](#check-event-tense)
- **Gaps:** [`event-without-fields`](#gap-event-without-fields), [`event-not-raised`](#gap-event-not-raised), [`event-without-event-type`](#gap-event-without-event-type)

<a id="table-domain_event"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The event's ID, such as TL-LEND-EV01. |
| `title` | VARCHAR | yes | The event's name, in the past tense, such as Tool repaired. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | yes | The aggregate it happens to. |
| `published` | BOOLEAN | yes | true: its shape is a promise to other domains, whose policies may hear it; false: only its own domain hears it. |
| `description` | VARCHAR | yes | What happened and what brings it about, in a sentence. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-event_field"></a>

#### `event_field`

One field a domain event carries, in order. A published event's fields are a contract with other domains.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `domain_event_id` | VARCHAR → [`domain_event`](#table-domain_event) | yes | The domain event. |
| `position` | INTEGER | yes | The field's place in the event, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Repaired at: one name in its event, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | ENUM('text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no') | no | Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. |
| `type_value_object_id` | VARCHAR → [`value_object`](#table-value_object) | no | The value object that is its type, if one. |
| `type_aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | no | The aggregate it refers to by ID, if one. |
| `required` | BOOLEAN | yes | true: every record gives it a value; false: it may be empty. |
| `column_name` | VARCHAR | no | Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `domain_event_id`, `position`
- **Unique:** `domain_event_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `(((CAST(("type" IS NOT NULL) AS INTEGER) + CAST((type_value_object_id IS NOT NULL) AS INTEGER)) + CAST((type_aggregate_id IS NOT NULL) AS INTEGER)) = 1)`

<a id="kind-command"></a>

### Command (`command`)

A request to change exactly one aggregate: the one its entity belongs to. It sits under the entity it changes, and checks specifications, raises events and may call domain services, all of its own domain.

- **Parents:** [`entity`](#kind-entity) (`entity_id`)
- **Children:** [`policy`](#kind-policy), [`endpoint`](#kind-endpoint), [`command_handler`](#kind-command_handler)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-CMD<nn>`, such as `TL-LEND-CMD01`; it starts with its domain's ID
- **Links out:** Calls ([`calls`](#relation-calls)), Checks ([`checks`](#relation-checks)), Raises ([`raises`](#relation-raises))
- **Links in:** Questions about this ([`about`](#relation-about)), Invoked by ([`invokes`](#relation-invokes)), Presented in ([`presents`](#relation-presents))
- **Gaps:** [`command-without-handler`](#gap-command-without-handler)

<a id="table-command"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The command's ID, such as TL-LEND-CMD01. |
| `title` | VARCHAR | yes | What it asks for, in the imperative, such as Open a loan. |
| `entity_id` | VARCHAR → [`entity`](#table-entity) | yes | The entity it changes, the root or a child; its aggregate is the one the command changes. |
| `description` | VARCHAR | yes | What it changes and when it is refused, in a sentence or two; how its handler does it belongs to the handler. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-read_model"></a>

### Read model (`read_model`)

A view of its domain's data shaped for reading, which reads one or more of the domain's aggregates. Its fields are read_model_field rows, and it is stored in a table of its own.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`query`](#kind-query), [`storage_requirement`](#kind-storage_requirement), [`table`](#kind-table), [`projection`](#kind-projection), [`reader`](#kind-reader)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-RM<nn>`, such as `TL-LEND-RM01`; it starts with its domain's ID
- **Links out:** Calls ([`calls`](#relation-calls)), Fed by ([`fed_by`](#relation-fed_by)), Reads ([`reads`](#relation-reads))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`read_model_field`](#table-read_model_field)
- **Checks:** [`serves-no-outcome`](#check-serves-no-outcome)
- **Gaps:** [`read-model-without-fields`](#gap-read-model-without-fields), [`read-model-reads-nothing`](#gap-read-model-reads-nothing), [`read-model-without-query`](#gap-read-model-without-query), [`read-model-without-projection`](#gap-read-model-without-projection), [`read-model-without-reader`](#gap-read-model-without-reader), [`read-model-without-table`](#gap-read-model-without-table)

<a id="table-read_model"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The read model's ID, such as TL-LEND-RM01. |
| `title` | VARCHAR | yes | The read model's name, such as Overdue loans. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `description` | VARCHAR | yes | What it shows, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-read_model_field"></a>

#### `read_model_field`

One field of a read model, in order. Its table's columns follow from it.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | yes | The read model. |
| `position` | INTEGER | yes | The field's place in the read model, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Days overdue: one name in its read model, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | ENUM('text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no') | no | Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. |
| `type_value_object_id` | VARCHAR → [`value_object`](#table-value_object) | no | The value object that is its type, if one. |
| `type_aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | no | The aggregate it refers to by ID, if one. |
| `required` | BOOLEAN | yes | true: every record gives it a value; false: it may be empty. |
| `column_name` | VARCHAR | no | Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `read_model_id`, `position`
- **Unique:** `read_model_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `(((CAST(("type" IS NOT NULL) AS INTEGER) + CAST((type_value_object_id IS NOT NULL) AS INTEGER)) + CAST((type_aggregate_id IS NOT NULL) AS INTEGER)) = 1)`

<a id="kind-query"></a>

### Query (`query`)

A question asked of one read model, its parent. It changes nothing, and may select by specifications and call domain services of its own domain.

- **Parents:** [`read_model`](#kind-read_model) (`read_model_id`)
- **Children:** [`endpoint`](#kind-endpoint), [`query_handler`](#kind-query_handler)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-QRY<nn>`, such as `TL-LEND-QRY01`; it starts with its domain's ID
- **Links out:** Calls ([`calls`](#relation-calls)), Selects by ([`selects_by`](#relation-selects_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Invoked by ([`invokes`](#relation-invokes)), Presented in ([`presents`](#relation-presents))
- **Checks:** [`query-title-verb`](#check-query-title-verb)
- **Gaps:** [`query-without-handler`](#gap-query-without-handler)

<a id="table-query"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The query's ID: its read model's domain's ID and QRY<nn>, such as TL-LEND-QRY01. |
| `title` | VARCHAR | yes | What it asks, such as List a member's loans. |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | yes | The read model it reads. |
| `description` | VARCHAR | yes | What it returns, in a sentence or two; the code that answers it belongs to its handler. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-policy"></a>

### Policy (`policy`)

Whenever an event, then a command (event storming). It belongs to the command it invokes and hears one event: its own domain's, or another domain's published one.

- **Parents:** [`command`](#kind-command) (`command_id`)
- **Children:** [`event_handler`](#kind-event_handler), [`policy_test`](#kind-policy_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its command.
  - **Built:** Its event handler names a file that exists.
  - **Proved:** Its policy test.
- **ID:** `<P>-<D>-PO<nn>`, such as `TL-LEND-PO01`; it starts with its domain's ID
- **Links out:** Hears ([`hears`](#relation-hears)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`event-not-by-outbox`](#check-event-not-by-outbox), [`serves-no-outcome`](#check-serves-no-outcome)
- **Gaps:** [`policy-hears-nothing`](#gap-policy-hears-nothing)

<a id="table-policy"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The policy's ID, such as TL-LEND-PO01. |
| `title` | VARCHAR | yes | The reaction in a few words, such as Close loans of a retired tool. |
| `command_id` | VARCHAR → [`command`](#table-command) | yes | The command it invokes. |
| `statement` | VARCHAR | yes | The reaction: whenever the event, then the command, stated with MUST, SHOULD or MAY. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-domain_service"></a>

### Domain service (`domain_service`)

Domain logic that belongs to no single entity and is not a yes-or-no check, such as calculating a late fee. Commands and queries of its domain call it; it uses no storage and no outside system.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`service`](#kind-service), [`domain_service_test`](#kind-domain_service_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its domain.
  - **Built:** Its service names a file that exists.
  - **Proved:** One of its domain service tests.
- **ID:** `<P>-<D>-DS<nn>`, such as `TL-LEND-DS01`; it starts with its domain's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Called by ([`calls`](#relation-calls))
- **Checks:** [`serves-no-outcome`](#check-serves-no-outcome)
- **Gaps:** [`domain-service-not-called`](#gap-domain-service-not-called)

<a id="table-domain_service"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The domain service's ID, such as TL-LEND-DS01. |
| `title` | VARCHAR | yes | What it works out, such as Late fee. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `statement` | VARCHAR | yes | What it must work out, from what, stated with MUST, SHOULD or MAY. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-storage_requirement"></a>

### Storage requirement (`storage_requirement`)

What the business needs kept of one aggregate or read model, its parent, and how well: whichever apply of durability (it survives a restart or a crash), atomicity (saved whole or not at all, such as a loan with its outbox event), retention and deletion (how long it is kept, and deleted on request), recovery (backups, and how much may be lost) and capacity (how much, how fast). It is built by its aggregate's repository, or its read model's reader, naming a file that exists and the data store it is stored in, and proved by its storage requirement tests.

- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`), [`read_model`](#kind-read_model) (`read_model_id`)
- **Children:** [`storage_requirement_test`](#kind-storage_requirement_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its aggregate or read model.
  - **Built:** Its aggregate's repository, or its read model's reader, names a file that exists and the data store it is stored in.
  - **Proved:** One of its storage requirement tests.
- **ID:** `<aggregate or read model>-SR<nn>`, such as `TL-LEND-A1-SR01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-storage_requirement"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The requirement's ID: its aggregate's or read model's ID and SR<nn>, such as TL-LEND-A1-SR01. |
| `title` | VARCHAR | yes | The requirement in a few words, such as A loan is saved with its outbox event. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | no | The aggregate whose data it is about; exactly one of aggregate and read model is given. |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | no | The read model whose data it is about; exactly one of aggregate and read model is given. |
| `statement` | VARCHAR | yes | What must be kept and how well, stated with MUST, MUST NOT, SHOULD or MAY. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`
- **Rule:** `((aggregate_id IS NULL) != (read_model_id IS NULL))`

<a id="kind-term"></a>

### Term (`term`)

A word of the domain's glossary and what it means there, so specs, code and conversation use one language.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-TM<nn>`, such as `TL-LEND-TM01`; it starts with its domain's ID
- **Links out:** Builds on ([`builds_on`](#relation-builds_on))
- **Links in:** Questions about this ([`about`](#relation-about)), Built on by ([`builds_on`](#relation-builds_on))
- **Checks:** [`term-used-unlinked`](#check-term-used-unlinked)

<a id="table-term"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The term's ID, such as TL-LEND-TM01. |
| `title` | VARCHAR | yes | The term, such as Loan. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain whose language it belongs to. |
| `meaning` | VARCHAR | yes | What it means in that domain. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its domain's terms, such as Records or Writing. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(meaning) != '')`

### Checks: domain model

<a id="check-value-object-unused"></a>

### `value-object-unused`

**Error** · Lathe's · Kinds: [`value_object`](#kind-value_object)

A value object that nothing uses.

A value object has no owner: it exists because fields of entities, value objects, events or read models are typed with it. One that nothing uses is a leftover, or a link is missing. Type the fields that hold it with it, or remove it.

<a id="check-specification-unused"></a>

### `specification-unused`

**Error** · Lathe's · Kinds: [`specification`](#kind-specification)

A specification that nothing uses.

A specification has no owner: it exists because commands check it and queries select by it. One that nothing uses is a leftover, or a link is missing. Link the commands that check it or the queries that select by it, or remove it.

<a id="check-event-not-by-outbox"></a>

### `event-not-by-outbox`

**Warning** · Lathe's · Kinds: [`domain_event`](#kind-domain_event), [`event_type`](#kind-event_type), [`policy`](#kind-policy)

An event a policy hears, whose aggregate is stored in a database table, whose event type is not delivered by outbox.

An event a policy hears, whose aggregate is stored in a database table (an entity of the aggregate has a table whose storage is `table`), in its own domain or, when published, in another, is delivered by outbox: saved in the same transaction as its aggregate and delivered reliably afterwards, since a lost reaction is a lost change. Its event type records the delivery; one delivered in process, with no delivery given, or no event type at all, leaves the reaction to chance. The rule reads the aggregate's storage because an outbox joins the database transaction that saves the aggregate. Give the event an event type delivered by outbox.

<a id="check-term-used-unlinked"></a>

### `term-used-unlinked`

**Warning** · Lathe's · Kinds: [`term`](#kind-term)

A term's meaning uses another term of its product by title without a builds_on link to it.

Definitions build up, never in a circle (LA-STD-MODELING-R12): a term is defined only by plain words and terms below it, and names each one it uses with builds_on, so the store can refuse a loop. The check reads each meaning in lower case, with text in backticks left out as code, and looks for every other term of the product by title as a whole word, singular or plural (a title ending in a consonant and y also as -ies); a shorter title found only inside a longer term's title (Domain inside Domain event) does not count. It cannot tell a word used in another sense, so it is a warning. Link the term with builds_on to the term it uses, or say it in plain words.

<a id="check-entity-unreferenced"></a>

### `entity-unreferenced`

**Warning** · Lathe's · Kinds: [`entity`](#kind-entity)

A child entity that its aggregate's root does not reach.

Each child entity is a part of its aggregate's root, so a `has_one` or `has_many` reaches it from the root, directly or through other children of the same aggregate. Link the child from the root or from another child with `has_one` or `has_many`.

<a id="check-event-tense"></a>

### `event-tense`

**Warning** · Lathe's · Kinds: [`domain_event`](#kind-domain_event)

A domain event's title reads as something that happened, in the past tense.

An event is named for what happened, such as Loan opened or Payment sent. The check is a heuristic over the title's words, in any letter case and split at anything but a letter: the title passes when its last word, or any word after its first (the word after a one-word subject, as in Loan became overdue), is a past form. A past form is a word of four or more letters ending in "-ed", other than the few such words that are not verbs in the past (need, seed, feed, speed, breed, bleed, embed, proceed, exceed, succeed, hundred, naked, sacred, wicked), or one of the irregular past forms the query lists. The heuristic can miss a past form it does not know, so this is a warning. Name the event in the past tense, as what happened (Tool returned, not Return tool), or add the word to the check's list if it is a past form the check does not know.

<a id="check-domain-named-for-technology"></a>

### `domain-named-for-technology`

**Warning** · Lathe's · Kinds: [`domain`](#kind-domain)

A domain is named for a technology layer or delivery channel rather than a business capability.

A domain is a vertical slice of business capability: it owns its model, its use cases, their interaction design, the technical records that implement them and their tests. Technology is expressed through the technical kinds inside each domain, never as a domain of its own. A domain whose title or domain code (its ID after the product prefix, such as LEND in TL-LEND) names a technology splits one capability across several domains. The words are web app, frontend, front end, backend, back end, API, UI, server, database, DB, desktop, mobile, engine, infrastructure, infra and Electron, matched as whole words in any letter case, with or without a space or hyphen inside the two-word ones, and in the plural. Only the title and code are read, never the description. Name the domain for the capability it serves.

<a id="check-aggregate-too-large"></a>

### `aggregate-too-large`

**Warning** · Lathe's · Kinds: [`aggregate`](#kind-aggregate), [`entity`](#kind-entity)

An aggregate with more entities than its product's max_entities_per_aggregate setting.

The setting is the product's product_setting row (7 when it has none). An aggregate is the smallest cluster of entities that must stay consistent after one command: one transaction changes it, and everything in it is loaded, locked and saved together. Most need a root and a few children; one that holds many entities is usually several clusters that change at different times, held together only by references, so every command pays for all of them and two people's changes clash for no reason. A rule that spans two aggregates is checked by a specification, or followed through an event and a policy. Split it into smaller aggregates that each change together.

<a id="check-specification-title-article"></a>

### `specification-title-article`

**Warning** · Lathe's · Kinds: [`specification`](#kind-specification)

A specification whose title starts with an article: A, An or The.

A specification is a yes/no condition a record meets or not, and its title names that condition with no article, such as "Tool is available" or "Member in good standing", so a command's or query's list of the specifications it checks reads as a list of conditions. Drop the article from the start of the title.

<a id="check-query-title-verb"></a>

### `query-title-verb`

**Warning** · Lathe's · Kinds: [`query`](#kind-query)

A query whose title does not start with Get, List or Find.

A query asks for data and changes nothing, so its title starts with the verb that says what comes back: Get for one thing, List for several, Find for a search, such as "Get a member's loans", "List overdue loans" or "Find a tool by name". A query titled like a command ("Check the workspace", "Export a theme") reads as a change. Retitle the query with Get, List or Find.

<a id="check-serves-no-outcome"></a>

### `serves-no-outcome`

**Warning** · Lathe's · Kinds: [`aggregate`](#kind-aggregate), [`read_model`](#kind-read_model), [`constraint`](#kind-constraint), [`invariant`](#kind-invariant), [`specification`](#kind-specification), [`policy`](#kind-policy), [`domain_service`](#kind-domain_service), [`storage_requirement`](#kind-storage_requirement), [`uc_requirement`](#kind-uc_requirement), [`view_requirement`](#kind-view_requirement), [`api_requirement`](#kind-api_requirement), [`pattern_rule`](#kind-pattern_rule), [`standard_rule`](#kind-standard_rule)

An aggregate, read model or obligation no business outcome reaches: no use case whose capability serves an outcome reaches it.

Everything in a product serves at least one business outcome (LA-STD-MODELING-R13). A record serves an outcome when a use case whose capability serves that outcome reaches it: through its steps, the commands and queries they invoke and what those change, check, call and read, the views they happen in, the endpoints that expose them, the integrations they exchange with and the patterns it follows (the Serves reach, LA-TRC-DS06, worked out on every load and never stored). An aggregate, read model or obligation none reaches is built for no one the product exists for: write the use case that needs it, with a step that invokes what reaches it, or remove it.

### Coverage gaps: domain model

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-domain-without-aggregate"></a>`domain-without-aggregate` | [`domain`](#kind-domain), [`aggregate`](#kind-aggregate) | A domain with no aggregate. |
| <a id="gap-aggregate-without-root"></a>`aggregate-without-root` | [`aggregate`](#kind-aggregate), [`entity`](#kind-entity) | An aggregate with no root entity. |
| <a id="gap-aggregate-without-command"></a>`aggregate-without-command` | [`aggregate`](#kind-aggregate), [`command`](#kind-command) | An aggregate no command changes. |
| <a id="gap-entity-without-fields"></a>`entity-without-fields` | [`entity`](#kind-entity), `entity_field` | An entity with no fields. |
| <a id="gap-value-object-without-fields"></a>`value-object-without-fields` | [`value_object`](#kind-value_object), `value_object_field` | A value object with no fields. |
| <a id="gap-event-without-fields"></a>`event-without-fields` | [`domain_event`](#kind-domain_event), `event_field` | A domain event that carries no fields. |
| <a id="gap-event-not-raised"></a>`event-not-raised` | [`domain_event`](#kind-domain_event), [`command`](#kind-command) | A domain event no command raises. |
| <a id="gap-read-model-without-fields"></a>`read-model-without-fields` | [`read_model`](#kind-read_model), `read_model_field` | A read model with no fields. |
| <a id="gap-read-model-reads-nothing"></a>`read-model-reads-nothing` | [`read_model`](#kind-read_model), [`aggregate`](#kind-aggregate) | A read model that reads no aggregate and is fed by no event. |
| <a id="gap-read-model-without-query"></a>`read-model-without-query` | [`read_model`](#kind-read_model), [`query`](#kind-query) | A read model no query asks. |
| <a id="gap-specification-reads-nothing"></a>`specification-reads-nothing` | [`specification`](#kind-specification), [`aggregate`](#kind-aggregate) | A specification that reads no aggregate. |
| <a id="gap-policy-hears-nothing"></a>`policy-hears-nothing` | [`policy`](#kind-policy), [`domain_event`](#kind-domain_event) | A policy that hears no event. |
| <a id="gap-domain-service-not-called"></a>`domain-service-not-called` | [`domain_service`](#kind-domain_service), [`command`](#kind-command), [`query`](#kind-query) | A domain service no command or query calls. |

<a id="stage-use-cases"></a>

## Use cases

Capabilities, the use cases in them with their actors and UC requirements, and the patterns use cases and domains follow.

<a id="kind-capability"></a>

### Capability (`capability`)

An ordered slice of a domain that groups its use cases, such as Catalog or Lending.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`use_case`](#kind-use_case)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-CAP<nn>`, such as `TL-LEND-CAP01`; it starts with its domain's ID
- **Links out:** Serves ([`serves`](#relation-serves))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`lone-child`](#check-lone-child), [`title-breaks-convention`](#check-title-breaks-convention)
- **Gaps:** [`capability-serves-no-outcome`](#gap-capability-serves-no-outcome), [`capability-without-use-case`](#gap-capability-without-use-case)

<a id="table-capability"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The capability's ID, such as TL-LEND-CAP01. |
| `title` | VARCHAR | yes | The capability's name, such as Catalog. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `position` | INTEGER | yes | Its place in the domain, from 1. |
| `description` | VARCHAR | yes | What the capability covers, in a sentence or two. |

- **Key:** `id`
- **Unique:** `domain_id`, `position`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"(description) != '')`

<a id="kind-use_case"></a>

### Use case (`use_case`)

An actor's goal: its actors (use_case_actor rows), its UC requirements and its flow, the same through every interface that offers it. It changes nothing itself; its flow's steps invoke commands and queries.

- **Parents:** [`capability`](#kind-capability) (`capability_id`)
- **Children:** [`uc_requirement`](#kind-uc_requirement), [`flow`](#kind-flow)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-UC<nn>`, such as `TL-LEND-UC01`; it starts with its domain's ID
- **Links out:** Follows ([`follows`](#relation-follows))
- **Links in:** Questions about this ([`about`](#relation-about)), Offered through ([`offers`](#relation-offers))
- **Parts:** [`use_case_actor`](#table-use_case_actor)
- **Checks:** [`pattern-setting-missing`](#check-pattern-setting-missing), [`pattern-not-followed`](#check-pattern-not-followed), [`title-breaks-convention`](#check-title-breaks-convention), [`flow-title-off-pattern`](#check-flow-title-off-pattern)
- **Gaps:** [`use-case-without-actor`](#gap-use-case-without-actor), [`use-case-without-requirement`](#gap-use-case-without-requirement), [`use-case-without-flow`](#gap-use-case-without-flow)

<a id="table-use_case"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The use case's ID, such as TL-LEND-UC01. |
| `title` | VARCHAR | yes | What the actor does, such as Borrow a tool. |
| `capability_id` | VARCHAR → [`capability`](#table-capability) | yes | The capability it sits in. |
| `goal` | VARCHAR | yes | What the actor wants to reach and from where they start, in a sentence or a short paragraph. |
| `notes` | VARCHAR | no | Longer notes, such as the order in which refusals are reported. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(goal) != '')`

<a id="table-use_case_actor"></a>

#### `use_case_actor`

One actor of a use case, in order: a role of the use case's product.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `use_case_id` | VARCHAR → [`use_case`](#table-use_case) | yes | The use case. |
| `position` | INTEGER | yes | The actor's place among the use case's actors, from 1; the first is the main actor. |
| `role_name` | VARCHAR | yes | The role, which the product names in its role rows. |

- **Key:** `use_case_id`, `position`
- **Unique:** `use_case_id`, `role_name`
- **Rule:** `("position" >= 1)`

<a id="kind-uc_requirement"></a>

### UC requirement (`uc_requirement`)

One rule a use case must follow, whatever the interface: a step of the use case's own flow fulfills it. A rule only one interface can meet is a view or API requirement, or a rule of that interface's pattern, instead.

- **Parents:** [`use_case`](#kind-use_case) (`use_case_id`)
- **Children:** [`use_case_test`](#kind-use_case_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** A step of its use case's flow fulfills it.
  - **Built:** Every record that carries out its fulfilling steps names a file that exists, and there is at least one: the handler of each command or query a step invokes, with the predicates and services of what that command or query checks, selects by or calls; and the adapter of each integration a step exchanges with. It also rests on those specifications and domain services, and is built only while each of them is.
  - **Proved:** One of its use case tests.
- **ID:** `<use case>-R<nn>`, such as `TL-LEND-UC01-R01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Fulfilled by ([`fulfills`](#relation-fulfills))
- **Checks:** [`lone-child`](#check-lone-child), [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-uc_requirement"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The requirement's ID: its use case's ID and R<nn>, such as TL-LEND-UC01-R01. |
| `title` | VARCHAR | yes | The requirement in a few words. |
| `use_case_id` | VARCHAR → [`use_case`](#table-use_case) | yes | The use case it belongs to. |
| `statement` | VARCHAR | yes | The requirement, stated with MUST, MUST NOT, SHOULD or MAY, in one sentence. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings, such as Validation or Paging. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-pattern"></a>

### Pattern (`pattern`)

Behavior several use cases share, stated once: a fixed part, the settings each use case that follows it fills in (its configuration, the known ways it varies) and its slots (the open-ended variation, filled with code against a contract). Its settings are pattern_setting rows, its rules pattern_rule records and its slots slot records.

- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`pattern_rule`](#kind-pattern_rule), [`slot`](#kind-slot)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-PAT-<name>`, such as `TL-PAT-LIBRARIAN-ACTION`; it starts with its parent's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Followed by ([`follows`](#relation-follows))
- **Parts:** [`pattern_setting`](#table-pattern_setting)
- **Checks:** [`pattern-setting-missing`](#check-pattern-setting-missing), [`pattern-not-followed`](#check-pattern-not-followed), [`pattern-candidate`](#check-pattern-candidate)
- **Gaps:** [`pattern-without-rule`](#gap-pattern-without-rule)

<a id="table-pattern"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The pattern's ID, such as TL-PAT-LIBRARIAN-ACTION. |
| `title` | VARCHAR | yes | The pattern's name, such as Librarian action. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `description` | VARCHAR | yes | The shared behavior, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes, such as how a domain or use case uses the pattern. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-pattern_setting"></a>

#### `pattern_setting`

One setting of a pattern, in order: what each follower decides.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `pattern_id` | VARCHAR → [`pattern`](#table-pattern) | yes | The pattern. |
| `position` | INTEGER | yes | The setting's place in the pattern, from 1. |
| `name` | VARCHAR | yes | The setting's name, in lower case with underscores, such as required_input. |
| `meaning` | VARCHAR | yes | What a follower decides in it. |

- **Key:** `pattern_id`, `position`
- **Unique:** `pattern_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"(meaning) != '')`

<a id="kind-pattern_rule"></a>

### Pattern rule (`pattern_rule`)

One rule of a pattern. Every domain that follows the pattern owes it, with no exception: a rule that holds for only some followers belongs to their use cases, not to the pattern.

- **Parents:** [`pattern`](#kind-pattern) (`pattern_id`)
- **Children:** [`pattern_rule_test`](#kind-pattern_rule_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** Wherever it is owed: by each domain that follows its pattern, itself, through a use case, or through an interface that offers one of its use cases.
  - **Built:** Not asked: proof only.
  - **Proved:** Its pattern rule test naming the owing domain.
- **ID:** `<pattern>-R<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-R01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`pattern-rule-test-outside-followers`](#check-pattern-rule-test-outside-followers), [`lone-child`](#check-lone-child), [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-pattern_rule"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The rule's ID: its pattern's ID and R<nn>, such as TL-PAT-LIBRARIAN-ACTION-R01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `pattern_id` | VARCHAR → [`pattern`](#table-pattern) | yes | The pattern it belongs to. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings, such as Validation or Paging. |
| `notes` | VARCHAR | no | Longer notes on how the rule applies. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-slot"></a>

### Slot (`slot`)

An open-ended part of a pattern, which neither its fixed part nor its settings can express: code fills it against its contract. A technical record that fills it, written by hand, is a fill (fills): accidental complexity recorded where it is owed, and debt until the pattern can derive it.

- **Parents:** [`pattern`](#kind-pattern) (`pattern_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<pattern>-SL<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-SL01`; it starts with its parent's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Filled by ([`fills`](#relation-fills))
- **Checks:** [`pattern-candidate`](#check-pattern-candidate)

<a id="table-slot"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The slot's ID: its pattern's ID and SL<nn>, such as TL-PAT-LIBRARIAN-ACTION-SL01. |
| `title` | VARCHAR | yes | What fills it, in a few words, such as Refusal message. |
| `pattern_id` | VARCHAR → [`pattern`](#table-pattern) | yes | The pattern it belongs to. |
| `statement` | VARCHAR | yes | Its contract: what every fill MUST do, in one sentence. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

### Checks: use cases

<a id="check-pattern-setting-missing"></a>

### `pattern-setting-missing`

**Error** · Lathe's · Kinds: [`use_case`](#kind-use_case), [`pattern`](#kind-pattern)

A use case that follows a pattern gives each of the pattern's settings.

Each setting of the pattern (a pattern_setting row) needs a setting_value row from each use case that follows it: the value the use case gives it. A domain that follows a pattern itself owes every rule and gives no settings. Give the missing setting a value.

<a id="check-pattern-not-followed"></a>

### `pattern-not-followed`

**Warning** · Lathe's · Kinds: [`pattern`](#kind-pattern), [`use_case`](#kind-use_case), [`domain`](#kind-domain)

A pattern that no use case and no domain follows.

No domain owes its rules, so they count in no domain's coverage. Link the use cases or domains that follow it with `follows`, or remove the pattern if nothing needs it.

<a id="check-lone-child"></a>

### `lone-child`

**Warning** · Lathe's · Kinds: [`capability`](#kind-capability), [`uc_requirement`](#kind-uc_requirement), [`view_requirement`](#kind-view_requirement), [`api_requirement`](#kind-api_requirement), [`pattern_rule`](#kind-pattern_rule), [`standard_rule`](#kind-standard_rule)

A capability or a group with exactly one child.

A level that holds one record groups nothing. A capability with exactly one child is reported, counting its own children of every kind (its use cases, and the records of a product's own kinds under it) but not theirs; one with none is a coverage gap instead. A group (the `group_name` of every kind that has one, read from the record_group view: terms, UC requirements, view requirements, API requirements, pattern rules, standard rules and a product's own kinds) is counted among its parent's children of one kind, compared trimmed and in any letter case, and reported on that parent. Merge it into a neighbor, or give it more.

<a id="check-title-breaks-convention"></a>

### `title-breaks-convention`

**Warning** · Lathe's · Kinds: [`capability`](#kind-capability), [`use_case`](#kind-use_case), [`interface`](#kind-interface)

A capability or use case title that breaks its naming convention: an interface named in it, a capability starting with The or an -ing word, or a list.

A capability is named as a noun phrase for a lasting ability of the business, two to four words: subject and activity noun, such as Invoice management or Member registration, or a single noun when the area is clear on its own, such as Catalog or Lending. A use case is named for one goal of its actor, verb first: verb and object, such as Borrow a tool or Approve an invoice, two to six words. Neither names a screen, a tool or a technology: a use case happens through interfaces, with one flow each, so the interface belongs to its flows, not its title. The check reads only the mechanical parts, in any letter case and as whole words: a use case or capability title that holds one of its product's interface titles or the words command line, CLI, desktop app, web app, MCP, API, agent tools, command layer or page (or their plurals); a capability title of two or more words that starts with "The" or with an -ing word (a word of five or more letters ending in -ing, other than the few that are not verbs, such as thing, string and evening), so a single noun such as Lending passes; either title that holds a list, a comma followed later by "and" or "or"; and a use case title that starts with a CRUD verb (create, read, update, delete, change or edit) and holds the word record, records or data, since a use case names the domain's own verb for its goal (Borrow a tool, Model an aggregate), never a verb over a record or data. Two goals joined by "and" with no comma are not read, nor is a use case title that does not start with a verb. Rename the capability or use case by the convention.

<a id="check-pattern-candidate"></a>

### `pattern-candidate`

**Warning** · Lathe's · Kinds: [`slot`](#kind-slot), [`pattern`](#kind-pattern)

A pattern's slot with three or more fills: what they repeat is a pattern candidate.

A fill is accidental complexity written by hand at a slot, against the slot's contract, and counted as accidental debt. Three fills of one slot are the same decision made three times: what they share can be stated once, in the pattern's fixed part or as a setting, and the code derived from it. One or two fills are not reported, since a pattern drawn from too few examples overfits. Make the pattern express what the fills repeat and generate them, or split the slot where they truly differ.

### Coverage gaps: use cases

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-capability-serves-no-outcome"></a>`capability-serves-no-outcome` | [`capability`](#kind-capability), [`business_outcome`](#kind-business_outcome) | A capability that serves no business outcome. |
| <a id="gap-capability-without-use-case"></a>`capability-without-use-case` | [`capability`](#kind-capability), [`use_case`](#kind-use_case) | A capability with no use case. |
| <a id="gap-use-case-without-actor"></a>`use-case-without-actor` | [`use_case`](#kind-use_case), `use_case_actor` | A use case with no actor. |
| <a id="gap-use-case-without-requirement"></a>`use-case-without-requirement` | [`use_case`](#kind-use_case), [`uc_requirement`](#kind-uc_requirement) | A use case with no UC requirement that follows no pattern. |
| <a id="gap-pattern-without-rule"></a>`pattern-without-rule` | [`pattern`](#kind-pattern), [`pattern_rule`](#kind-pattern_rule) | A pattern with no rule. |

<a id="stage-interaction-design"></a>

## Interaction design

The product's interfaces and the use cases each offers, each use case's flow and its steps, and the views, endpoints and integrations the steps reach, with their requirements.

<a id="kind-interface"></a>

### Interface (`interface`)

A way people or programs use the product, such as its web app, its HTTP API or its command line. It offers use cases (offers), is used by some of the product's roles (interface_actor rows) and follows the pattern that says how a step is carried out through it (follows): its version of each flow it offers is derived from that, never written.

- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-IF<nn>`, such as `TL-IF01`; it starts with its parent's ID
- **Links out:** Follows ([`follows`](#relation-follows)), Offers ([`offers`](#relation-offers))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`interface_actor`](#table-interface_actor)
- **Checks:** [`title-breaks-convention`](#check-title-breaks-convention), [`flow-title-off-pattern`](#check-flow-title-off-pattern)
- **Gaps:** [`interface-offers-nothing`](#gap-interface-offers-nothing)

<a id="table-interface"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The interface's ID: its product's ID and IF<nn>, such as TL-IF01. |
| `title` | VARCHAR | yes | The interface's name, such as Web app, HTTP API, CLI, MCP tools or Desktop app. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `kind` | ENUM('web app', 'API', 'CLI', 'agent tools', 'desktop', 'other') | yes | What it is: web app or desktop (a step is carried out in the views that present its command or query), API (through the endpoint that exposes it), CLI or agent tools (by the product's own command or tool for it), or other. |
| `description` | VARCHAR | yes | Who uses it and how, in a sentence or two. |
| `public` | BOOLEAN | yes | Whether people or programs outside the product build on it, so its contract is the product's own commitment: a public API's requirements are essential complexity, an internal one's (such as the API only the product's own app calls) accidental. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-interface_actor"></a>

#### `interface_actor`

One role that uses an interface, in order: a role of the interface's product. A step's actor through the interface is the first of its use case's actors the interface lists.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `interface_id` | VARCHAR → [`interface`](#table-interface) | yes | The interface. |
| `position` | INTEGER | yes | The role's place among the interface's roles, from 1. |
| `role_name` | VARCHAR | yes | The role, which the product names in its role rows. |

- **Key:** `interface_id`, `position`
- **Unique:** `interface_id`, `role_name`
- **Rule:** `("position" >= 1)`

<a id="kind-flow"></a>

### Flow (`flow`)

How its use case is carried out, whatever the interface: the steps on its main path and its alternate paths. A use case has one flow, and each interface that offers the use case has its own version of it, derived from the steps' commands and queries by the interface's pattern.

- **Parents:** [`use_case`](#kind-use_case) (`use_case_id`)
- **Children:** [`flow_step`](#kind-flow_step), [`flow_test`](#kind-flow_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<use case>-FL`, such as `TL-LEND-UC01-FL`; it starts with its parent's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`step-order`](#check-step-order), [`flow-title-off-pattern`](#check-flow-title-off-pattern)
- **Gaps:** [`flow-without-main-path`](#gap-flow-without-main-path), [`flow-without-test`](#gap-flow-without-test)

<a id="table-flow"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The flow's ID: its use case's ID and FL, such as TL-LEND-UC01-FL. |
| `title` | VARCHAR | yes | The flow's name: its use case's title, such as Borrow a tool. |
| `use_case_id` | VARCHAR → [`use_case`](#table-use_case) | yes | The use case it carries out, which has no other flow. |

- **Key:** `id`
- **Unique:** `use_case_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-flow_step"></a>

### Flow step (`flow_step`)

One step of a flow, in order on its path, in the words of the people who take it. It fulfills UC requirements of its own use case, invokes at most one command or query and may exchange with integrations; where it happens is its interface's, derived. A step only one interface can do is a variant: it names that interface.

- **Parents:** [`flow`](#kind-flow) (`flow_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<flow>-S<nn>`, such as `TL-LEND-UC01-FL-S01`; it starts with its parent's ID
- **Links out:** Exchanges with ([`exchanges_with`](#relation-exchanges_with)), Fulfills ([`fulfills`](#relation-fulfills)), Invokes ([`invokes`](#relation-invokes))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`step-order`](#check-step-order), [`step-unreached`](#check-step-unreached)
- **Gaps:** [`record-untraced`](#gap-record-untraced)

<a id="table-flow_step"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The step's ID: its flow's ID and S<nn>, such as TL-LEND-UC01-FL-S01. |
| `title` | VARCHAR | yes | What happens, in a few words. |
| `flow_id` | VARCHAR → [`flow`](#table-flow) | yes | The flow it belongs to. |
| `path` | VARCHAR | yes | The path through the flow the step is on, such as main or refused. |
| `position` | INTEGER | yes | The step's place on its path, from 1, among every interface's steps; each interface's version skips the other interfaces' variants. |
| `interface_id` | VARCHAR → [`interface`](#table-interface) | no | The one interface that does this step, which makes it a variant, such as opening the app from the Dock; none when every interface that offers the use case does it. The interface offers the step's use case. |

- **Key:** `id`
- **Unique:** `flow_id`, `path`, `position`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(path) != '')`
- **Rule:** `("position" >= 1)`

<a id="kind-view"></a>

### View (`view`)

A screen or page a person uses. It has no owner: it exists because it presents commands and queries (presents), so a step that invokes one is carried out in it on a web app or desktop interface, and its product follows from its ID.

- **Parents:** none (no owner: it exists because other records use it)
- **Children:** [`view_requirement`](#kind-view_requirement)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-V<nn>`, such as `TL-V01`; it starts with its product's ID
- **Links out:** Presents ([`presents`](#relation-presents))
- **Links in:** Questions about this ([`about`](#relation-about)), Rendered by ([`renders`](#relation-renders))
- **Checks:** [`view-unused`](#check-view-unused), [`view-route-not-in-file`](#check-view-route-not-in-file)
- **Gaps:** [`view-without-ui-component`](#gap-view-without-ui-component)

<a id="table-view"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The view's ID: the product prefix and V<nn>, such as TL-V01. |
| `title` | VARCHAR | yes | The view's name, such as Catalog. |
| `route` | VARCHAR | no | The address it is shown at, such as /catalog. |
| `interface_id` | VARCHAR → [`interface`](#table-interface) | no | The one interface that shows it, such as the desktop app's Dock icon; none when every web app and desktop interface of its product shows it. |
| `description` | VARCHAR | yes | What the view shows and lets a person do, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes on the view. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-view_requirement"></a>

### View requirement (`view_requirement`)

One rule a view must follow, such as what it shows while loading or a field's limits. The UI components whose code does what it says build it (builds).

- **Parents:** [`view`](#kind-view) (`view_id`)
- **Children:** [`view_test`](#kind-view_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its view.
  - **Built:** Every UI component that builds it names a file that exists, and there is at least one.
  - **Proved:** One of its view tests.
- **ID:** `<view>-R<nn>`, such as `TL-V01-R01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Built by ([`builds`](#relation-builds))
- **Checks:** [`lone-child`](#check-lone-child), [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-view_requirement"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The requirement's ID: its view's ID and R<nn>, such as TL-V01-R01. |
| `title` | VARCHAR | yes | The requirement in a few words. |
| `view_id` | VARCHAR → [`view`](#table-view) | yes | The view it belongs to. |
| `statement` | VARCHAR | yes | The requirement, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-endpoint"></a>

### Endpoint (`endpoint`)

An HTTP endpoint that exposes exactly one command or query, its parent. A step that invokes it is carried out through it on an API interface: steps reach it through their command or query, never directly.

- **Parents:** [`command`](#kind-command) (`command_id`), [`query`](#kind-query) (`query_id`)
- **Children:** [`api_requirement`](#kind-api_requirement), [`endpoint_handler`](#kind-endpoint_handler)
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<P>-<D>-EP<nn>`, such as `TL-LEND-EP01`; it starts with its domain's ID
- **Links out:** Fills ([`fills`](#relation-fills)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`endpoint-route-not-in-file`](#check-endpoint-route-not-in-file), [`step-unreached`](#check-step-unreached)
- **Gaps:** [`endpoint-without-requirement`](#gap-endpoint-without-requirement), [`endpoint-without-handler`](#gap-endpoint-without-handler)

<a id="table-endpoint"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The endpoint's ID, such as TL-LEND-EP01. |
| `title` | VARCHAR | yes | Its method and route, one space apart, such as POST /loans: refused otherwise. |
| `command_id` | VARCHAR → [`command`](#table-command) | no | The command it exposes; exactly one of command and query is given. |
| `query_id` | VARCHAR → [`query`](#table-query) | no | The query it exposes; exactly one of command and query is given. |
| `method` | ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS') | yes | The HTTP method. |
| `route` | VARCHAR | yes | The route, such as /loans or /tools/{toolId}/damage. |
| `description` | VARCHAR | yes | Its request and responses, in a sentence or two. |
| `notes` | VARCHAR | no | Longer notes on the endpoint. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(route) != '')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `((command_id IS NULL) != (query_id IS NULL))`
- **Rule:** `(title = ((CAST("method" AS VARCHAR) || ' ') || route))`

<a id="kind-api_requirement"></a>

### API requirement (`api_requirement`)

One rule an endpoint must follow, such as an error's response or a limit on its request.

- **Parents:** [`endpoint`](#kind-endpoint) (`endpoint_id`)
- **Children:** [`endpoint_test`](#kind-endpoint_test)
- **Complexity:** by its product's interfaces: essential on a public API, otherwise accidental
- **Obligation:** yes: designed, built and proved
  - **Designed:** By construction, under its endpoint.
  - **Built:** Its endpoint's handler names a file that exists.
  - **Proved:** One of its endpoint tests.
- **ID:** `<endpoint>-R<nn>`, such as `TL-LEND-EP01-R01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`lone-child`](#check-lone-child), [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-api_requirement"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The requirement's ID: its endpoint's ID and R<nn>, such as TL-LEND-EP01-R01. |
| `title` | VARCHAR | yes | The requirement in a few words. |
| `endpoint_id` | VARCHAR → [`endpoint`](#table-endpoint) | yes | The endpoint it belongs to. |
| `statement` | VARCHAR | yes | The requirement, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

<a id="kind-integration"></a>

### Integration (`integration`)

An outside system the product exchanges with, such as a payment provider or a mail service. It has no owner: it exists because flow steps exchange with it, and its product follows from its ID.

- **Parents:** none (no owner: it exists because other records use it)
- **Children:** [`adapter`](#kind-adapter), [`integration_test`](#kind-integration_test)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-INT<nn>`, such as `TL-INT01`; it starts with its product's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Exchanged with by ([`exchanges_with`](#relation-exchanges_with)), Provides ([`provided_by`](#relation-provided_by))
- **Checks:** [`integration-unused`](#check-integration-unused)
- **Gaps:** [`integration-without-adapter`](#gap-integration-without-adapter)

<a id="table-integration"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The integration's ID: the product prefix and INT<nn>, such as TL-INT01. |
| `title` | VARCHAR | yes | The integration's name. |
| `system` | VARCHAR | no | The outside system, such as Stripe. |
| `description` | VARCHAR | yes | What the product exchanges with it, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

### Checks: interaction design

<a id="check-view-unused"></a>

### `view-unused`

**Error** · Lathe's · Kinds: [`view`](#kind-view)

A view that presents no command or query.

A view has no owner: it exists because a person sends commands or asks queries in it, so a step that invokes one is carried out there on a web app or desktop interface. One that presents nothing is a leftover, or a link is missing. Link what it presents with presents, or remove it.

<a id="check-integration-unused"></a>

### `integration-unused`

**Error** · Lathe's · Kinds: [`integration`](#kind-integration)

An integration that nothing uses: no flow step exchanges with it, and it provides nothing.

An integration has no owner: it exists because flow steps exchange with it, or because it provides records of the product from outside it (provided_by), such as a platform or a dependency. One that nothing uses is a leftover, or a link is missing. Link the steps that exchange with it with exchanges_with, name it the provider of what it provides, or remove it.

<a id="check-step-order"></a>

### `step-order`

**Error** · Lathe's · Kinds: [`flow_step`](#kind-flow_step), [`flow`](#kind-flow)

The steps on each path of a flow are numbered 1, 2, 3 and so on, without gaps.

A flow's steps are read in `position` within their `path`, a short name such as main or refused, compared trimmed and in any letter case. The schema gives each step a whole number that no other step on its path has; a path whose positions skip a number is reported once, on the first step after the gap. Renumber the steps of the path to close the gap.

<a id="check-endpoint-route-not-in-file"></a>

### `endpoint-route-not-in-file`

**Error** · Lathe's · Kinds: [`endpoint`](#kind-endpoint), [`endpoint_handler`](#kind-endpoint_handler)

An endpoint whose handler's file does not name its method and route.

An endpoint handler serves its endpoint's method and route, so its file names both: the route, written any way routes are written (`/tools/{toolId}`, `/tools/:toolId`, `/tools/<tool-id>`, `/tools/[toolId]`, a template's `${toolId}`, or a regular expression literal that matches it, such as `/^\/tools\/(\d+)$/`), in code, a string or a comment. Parameters match whatever their names, and only the path counts: a query string or fragment is not part of a route. The method is written in capitals, or called as `.post(`, on the route's line or within two lines of it. Then a reader of the record finds the code, and a route changed on one side and not the other is caught. A handler whose file does not exist yet is technical-file-missing instead. Correct the endpoint's method or route, or point its handler at the file that serves it.

<a id="check-view-route-not-in-file"></a>

### `view-route-not-in-file`

**Error** · Lathe's · Kinds: [`view`](#kind-view), [`ui_component`](#kind-ui_component)

A view whose route no file of the UI components that render it names.

A view's route is the address it is shown at, and the UI components that render it show it there, so one of their files names the route, written any way routes are written (`/tools/{toolId}`, `/tools/:toolId`, `/tools/<tool-id>`, `/tools/[toolId]`, a template's `${toolId}`, or a regular expression literal that matches it, such as `/^\/tools\/(\d+)$/`), in code, a string or a comment. Parameters match whatever their names, and only the path counts: a query string or fragment is not part of a route. Then a reader of the record finds the code, and an address changed on one side and not the other is caught. A view with no route, or whose components' files do not exist yet, is not checked. Correct the view's route, or name it in the file of the component that shows the view at that address.

<a id="check-step-unreached"></a>

### `step-unreached`

**Warning** · Lathe's · Kinds: [`flow_step`](#kind-flow_step), [`endpoint`](#kind-endpoint)

A step that invokes a command or query one of the interfaces that offer its use case cannot reach.

A use case's flow is the same through every interface that offers it, and each interface carries a step out through its own means: a web app or desktop in a view that presents the step's command or query (a view of every such interface, or of that one), an API through the endpoint that exposes it, a CLI or agent tools through a record of the product's own interaction design kinds under it (such as Lathe's CLI commands). So each interface that offers the use case must reach what each step invokes, but for a step that is another interface's variant. An interface of kind other reaches its operations in a way no record says, so it is not read. Have a view present the command or query, add the endpoint or the product's own record under it, make the step a variant of the interfaces that do reach it, or stop offering the use case through that interface.

<a id="check-flow-title-off-pattern"></a>

### `flow-title-off-pattern`

**Warning** · Lathe's · Kinds: [`flow`](#kind-flow), [`use_case`](#kind-use_case), [`interface`](#kind-interface)

A flow whose title is not its use case's title.

A use case has one flow, the same through every interface that offers it, so the flow's title is its use case's: a renamed use case then shows in a flow that still has the old title. The check compares trimmed and in any letter case. Retitle the flow as its use case.

### Coverage gaps: interaction design

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-use-case-without-flow"></a>`use-case-without-flow` | [`use_case`](#kind-use_case), [`flow`](#kind-flow) | A use case with no flow. |
| <a id="gap-interface-offers-nothing"></a>`interface-offers-nothing` | [`interface`](#kind-interface), [`use_case`](#kind-use_case) | An interface that offers no use case. |
| <a id="gap-flow-without-main-path"></a>`flow-without-main-path` | [`flow`](#kind-flow), [`flow_step`](#kind-flow_step) | A flow with no step on its main path. |
| <a id="gap-endpoint-without-requirement"></a>`endpoint-without-requirement` | [`endpoint`](#kind-endpoint), [`api_requirement`](#kind-api_requirement) | An endpoint with no API requirement. |
| <a id="gap-route-without-record"></a>`route-without-record` | [`product`](#kind-product), [`endpoint`](#kind-endpoint), [`view`](#kind-view) | A route the code serves that no endpoint or view has. |
| <a id="gap-record-untraced"></a>`record-untraced` | [`flow_step`](#kind-flow_step), [`command`](#kind-command), [`query`](#kind-query), [`ui_component`](#kind-ui_component) | A flow step, command, query or UI component no obligation's chain reaches. |

<a id="stage-technical-specification"></a>

## Technical specification

The technical record that implements each design record, such as a command's handler or an entity's table, and the standards code meets.

<a id="kind-data_store"></a>

### Data store (`data_store`)

Where data actually lives: a database, a bucket, a folder of files, browser storage or memory. Every repository, reader and table names the one it is stored in (stored_in). One that is a service someone else runs, which the user must provide, such as a managed database or a bucket, is reached through its integration (provided_by); one the product owns outright, such as a local file or browser storage, has none.

- **Parents:** [`product`](#kind-product) (`product_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<P>-STORE<nn> or <P>-<D>-STORE<nn>`, such as `TL-STORE01`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Stores ([`stored_in`](#relation-stored_in))
- **Gaps:** [`data-store-unused`](#gap-data-store-unused)

<a id="table-data_store"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The data store's ID: its product's ID and STORE<nn>, or its domain's ID and STORE<nn>, such as TL-STORE01. |
| `title` | VARCHAR | yes | Its name in code or config, such as DATABASE_URL, dataDir or localStorage. |
| `product_id` | VARCHAR → [`product`](#table-product) | no | The product it sits under, when several of its domains use it; exactly one of product and domain is given. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | no | The domain it sits under, when one domain alone uses it; exactly one of product and domain is given. |
| `kind` | ENUM('database', 'object store', 'file folder', 'file', 'browser storage', 'memory') | yes | database: a database server or file, such as PostgreSQL or SQLite; object store: a bucket of objects, such as S3; file folder: a folder of files the program reads and writes; file: one file the program reads and writes whole; browser storage: kept by the browser, such as local or session storage or its history; memory: kept only while the program runs, and rebuilt on each start. |
| `description` | VARCHAR | yes | Where it is and what keeps it there, in a sentence or two: its location, who runs it and how it is reached. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `((product_id IS NULL) != (domain_id IS NULL))`

<a id="kind-repository"></a>

### Repository (`repository`)

Loads and saves its aggregate, whole: the way command handlers reach the aggregate's storage, in the one data store it names (stored_in). It persists exactly one aggregate, linked with persists, and sits under its domain, or, for one several domains share, under the domain that holds what they share.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<domain>-REPO<nn>`, such as `TL-LEND-REPO01`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Persists ([`persists`](#relation-persists)), Provided by ([`provided_by`](#relation-provided_by)), Stored in ([`stored_in`](#relation-stored_in))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest), [`repository-persists-nothing`](#check-repository-persists-nothing)
- **Gaps:** [`stored-nowhere`](#gap-stored-nowhere)

<a id="table-repository"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The repository's ID: its domain's ID and REPO<nn>, such as TL-LEND-REPO01. |
| `title` | VARCHAR | yes | Its name in code, such as LoanRepository. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it sits under: that of the aggregate it persists, or, for one several domains share, the domain that holds what they share. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it keeps its aggregate: where, in what form, and when it loads and saves, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-data_model"></a>

### Data model (`data_model`)

Its entity in code: the entity's data, behavior and mapping to its table. A command is carried out by its handler and its aggregate root's data model.

- **Parents:** [`entity`](#kind-entity) (`entity_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<entity>-DM`, such as `TL-LEND-EN01-DM`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-data_model"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The data model's ID: its entity's ID and DM, such as TL-LEND-EN01-DM. |
| `title` | VARCHAR | yes | Its name in code, such as Loan. |
| `entity_id` | VARCHAR → [`entity`](#table-entity) | yes | The entity it implements; one data model each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `entity_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-table"></a>

### Table (`table`)

Where an entity or a read model, its parent, is stored, in a database or not; or, under a domain, a table of the domain's own infrastructure that implements no design record, such as its outbox. It is kept in the one data store it names (stored_in). Its columns follow from its parent's fields, a value object's fields flattened into columns, so it stores only what fields cannot say: its keys and indexes (table_key rows). An entity's table holds its rows, the source of truth: a table, normalized, or the browser storage, file or memory that keeps them; a read model's is a projection that can be rebuilt, usually a view over its domain's entity tables, or computed in memory on each load.

- **Parents:** [`entity`](#kind-entity) (`entity_id`), [`read_model`](#kind-read_model) (`read_model_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<entity or read model>-TB, or <domain>-TB<nn>`, such as `TL-LEND-EN01-TB`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by)), Stored in ([`stored_in`](#relation-stored_in))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Parts:** [`table_key`](#table-table_key)
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`table-schema-mismatch`](#check-table-schema-mismatch), [`package-not-in-manifest`](#check-package-not-in-manifest)
- **Gaps:** [`table-without-file`](#gap-table-without-file)

<a id="table-table"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The table's ID: its entity's or read model's ID and TB, such as TL-LEND-EN01-TB. |
| `title` | VARCHAR | yes | The table as people read it, such as Loans. |
| `entity_id` | VARCHAR → [`entity`](#table-entity) | no | The entity it stores; exactly one of entity, read model and domain is given. An entity has at most one table: a child entity marked in_root_table has none and is stored in its root's. |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | no | The read model it stores; exactly one of entity, read model and domain is given, and a read model has one table. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | no | The domain whose own infrastructure it stores, such as its outbox, when it stores no entity or read model; its ID is the domain's and TB with a number, such as TL-LEND-TB01, and its storage is a table. |
| `name` | VARCHAR | yes | Its name where it is stored: in the database, such as loans, the key it is kept under in browser storage, such as lathe:tabs, or the file's name, such as window-state.json. |
| `storage` | ENUM('table', 'view', 'materialized view', 'browser storage', 'file', 'in memory') | yes | table: rows of its own in a database; view: a query over other tables; materialized view: a query's result, kept; browser storage: kept by the browser (local or session storage, or its history), under the key its name gives; file: kept in a file of its own that the program reads and writes whole, such as a JSON file, named by its name; in memory: kept only while the program runs, or computed on each load. An entity's table holds rows of its own, so it is never a view or a materialized view. Keys are asked only of a table in a database: browser storage, a file and in memory have none. |
| `file` | VARCHAR | no | The file that creates it, such as a migration, or that reads and writes it, from the product root; it may not exist yet. |

- **Key:** `id`
- **Unique:** `entity_id`
- **Unique:** `read_model_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `(((CAST((entity_id IS NOT NULL) AS INTEGER) + CAST((read_model_id IS NOT NULL) AS INTEGER)) + CAST((domain_id IS NOT NULL) AS INTEGER)) = 1)`
- **Rule:** `((domain_id IS NULL) OR ("storage" = 'table'))`
- **Rule:** `((entity_id IS NULL) OR (NOT ("storage" IN ('view', 'materialized view'))))`

<a id="table-table_key"></a>

#### `table_key`

One key or index of a table in a database (never of browser storage, a file or in memory), in order: its primary key, a unique key with the invariant it enforces, a foreign key with the table it points at, or an index. A foreign key points at a table of the same domain: a reference to another domain's aggregate stays a plain ID.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `table_id` | VARCHAR → [`table`](#table-table) | yes | The table. |
| `position` | INTEGER | yes | The key's place among the table's keys, from 1. |
| `type` | ENUM('primary', 'unique', 'foreign', 'index') | yes | primary (at most one per table), unique, foreign or index. |
| `columns` | VARCHAR[] | yes | Its columns, in order, by their names in the database. |
| `name` | VARCHAR | no | Its name in the database, if it has one. |
| `invariant_id` | VARCHAR → [`invariant`](#table-invariant) | no | For a unique key, the invariant it enforces, such as no two members sharing an email. |
| `target_table_id` | VARCHAR → [`table`](#table-table) | no | For a foreign key, the table it points at, of the same domain; required for a foreign key and only for one. |
| `condition` | VARCHAR | no | For a partial unique key, the rows it holds for, such as returned_at IS NULL for one active loan per tool; only a unique key has one. |

- **Key:** `table_id`, `position`
- **Rule:** `("position" >= 1)`
- **Rule:** `(len("columns") >= 1)`
- **Rule:** `((invariant_id IS NULL) OR ("type" = 'unique'))`
- **Rule:** `((condition IS NULL) OR ("type" = 'unique'))`
- **Rule:** `(("type" = 'foreign') = (target_table_id IS NOT NULL))`

<a id="kind-value_type"></a>

### Value type (`value_type`)

Its value object in code, which checks the value object's constraints when a value is created.

- **Parents:** [`value_object`](#kind-value_object) (`value_object_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<value object>-VT`, such as `TL-VO01-VT`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-value_type"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The value type's ID: its value object's ID and VT, such as TL-VO01-VT. |
| `title` | VARCHAR | yes | Its name in code, such as EmailAddress. |
| `value_object_id` | VARCHAR → [`value_object`](#table-value_object) | yes | The value object it implements; one value type each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `value_object_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-rule"></a>

### Rule (`rule`)

Enforces its invariant: the rule in its aggregate's code, run by the aggregate's commands before saving, which refuses a change that would break it. Lathe's own rules sit in each aggregate's rules.ts and also run over all data on every load. An invariant is built only through its rule.

- **Parents:** [`invariant`](#kind-invariant) (`invariant_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<invariant>-RL`, such as `TL-LEND-INV01-RL`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))

<a id="table-rule"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The rule's ID: its invariant's ID and RL, such as TL-LEND-INV01-RL. |
| `title` | VARCHAR | yes | Its name in code, the name its refusal carries, such as step-fulfills-own-use-case or email_taken. |
| `invariant_id` | VARCHAR → [`invariant`](#table-invariant) | yes | The invariant it enforces; one rule each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root, such as its aggregate's rules.ts; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `invariant_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-predicate"></a>

### Predicate (`predicate`)

Its specification in code: a yes-or-no test over the records it is given.

- **Parents:** [`specification`](#kind-specification) (`specification_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<specification>-PR`, such as `TL-LEND-SP01-PR`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-predicate"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The predicate's ID: its specification's ID and PR, such as TL-LEND-SP01-PR. |
| `title` | VARCHAR | yes | Its name in code, such as isInGoodStanding. |
| `specification_id` | VARCHAR → [`specification`](#table-specification) | yes | The specification it implements; one predicate each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `specification_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-event_type"></a>

### Event type (`event_type`)

Its domain event's shape in code; a contract with other domains when the event is published.

- **Parents:** [`domain_event`](#kind-domain_event) (`domain_event_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<domain event>-ET`, such as `TL-LEND-EV01-ET`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`event-not-by-outbox`](#check-event-not-by-outbox), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-event_type"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The event type's ID: its domain event's ID and ET, such as TL-LEND-EV01-ET. |
| `title` | VARCHAR | yes | Its name in code, such as LoanOpened. |
| `domain_event_id` | VARCHAR → [`domain_event`](#table-domain_event) | yes | The domain event it implements; one event type each. |
| `delivery` | ENUM('in process', 'outbox') | no | How the event reaches what hears it: in process, after the transaction commits; or outbox, saved in the same transaction as its aggregate and delivered reliably afterwards. An event a policy hears is delivered by outbox, since a lost reaction is a lost change; one that only keeps read models current (fed_by), where those read models are rebuilt from the data on every load, may be delivered in process. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `domain_event_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-projection"></a>

### Projection (`projection`)

Fills its read model's table and keeps it current, from events or as a view's query. It writes only its own read model's table.

- **Parents:** [`read_model`](#kind-read_model) (`read_model_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<read model>-PJ`, such as `TL-LEND-RM01-PJ`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-projection"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The projection's ID: its read model's ID and PJ, such as TL-LEND-RM01-PJ. |
| `title` | VARCHAR | yes | Its name in code, such as overdueLoans. |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | yes | The read model it fills; one projection each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it fills its read model and when it is rebuilt, in a sentence or two. |

- **Key:** `id`
- **Unique:** `read_model_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-reader"></a>

### Reader (`reader`)

Reads its read model's table for its query handlers: the way query handlers reach a read model's storage, in the one data store it names (stored_in). It reads exactly one read model, its parent, and nothing else; a query handler reads only through its own read model's reader, and the projection alone fills the table it reads.

- **Parents:** [`read_model`](#kind-read_model) (`read_model_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<read model>-RD`, such as `TL-LEND-RM01-RD`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by)), Stored in ([`stored_in`](#relation-stored_in))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))

<a id="table-reader"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The reader's ID: its read model's ID and RD, such as TL-LEND-RM01-RD. |
| `title` | VARCHAR | yes | Its name in code, such as OverdueLoansReader. |
| `read_model_id` | VARCHAR → [`read_model`](#table-read_model) | yes | The read model it reads; one reader each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it reads its read model's table: where the table is kept and how a query handler is given the reader, in a sentence or two. |

- **Key:** `id`
- **Unique:** `read_model_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-command_handler"></a>

### Command handler (`command_handler`)

Carries out its command: an application service that owns the transaction, loads the aggregate through its repository, checks specifications and raises events. What clean architecture calls a use case or interactor.

- **Parents:** [`command`](#kind-command) (`command_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<command>-H`, such as `TL-LEND-CMD01-H`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-command_handler"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The command handler's ID: its command's ID and H, such as TL-LEND-CMD01-H. |
| `title` | VARCHAR | yes | Its name in code, such as openLoan. |
| `command_id` | VARCHAR → [`command`](#table-command) | yes | The command it handles; one command handler each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it carries out its command (transaction, checks, what it writes), in a sentence or two; never what the command already says. |

- **Key:** `id`
- **Unique:** `command_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-query_handler"></a>

### Query handler (`query_handler`)

Answers its query from its read model's table: an application service that changes nothing.

- **Parents:** [`query`](#kind-query) (`query_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<query>-H`, such as `TL-LEND-QRY01-H`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-query_handler"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The query handler's ID: its query's ID and H, such as TL-LEND-QRY01-H. |
| `title` | VARCHAR | yes | Its name in code, such as listLoans. |
| `query_id` | VARCHAR → [`query`](#table-query) | yes | The query it answers; one query handler each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it answers its query (from what, kept or computed on each call), in a sentence or two. |

- **Key:** `id`
- **Unique:** `query_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-event_handler"></a>

### Event handler (`event_handler`)

Carries out its policy: hears the policy's event and sends its command.

- **Parents:** [`policy`](#kind-policy) (`policy_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<policy>-H`, such as `TL-LEND-PO01-H`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-event_handler"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The event handler's ID: its policy's ID and H, such as TL-LEND-PO01-H. |
| `title` | VARCHAR | yes | Its name in code, such as onToolRetired. |
| `policy_id` | VARCHAR → [`policy`](#table-policy) | yes | The policy it carries out; one event handler each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | Where it hears its event and how it sends its command, in a sentence or two. |

- **Key:** `id`
- **Unique:** `policy_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-service"></a>

### Service (`service`)

Its domain service in code. It never uses a repository or an outside system: its inputs are passed in, and it returns a value or a decision.

- **Parents:** [`domain_service`](#kind-domain_service) (`domain_service_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<domain service>-SV`, such as `TL-LEND-DS01-SV`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-service"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The service's ID: its domain service's ID and SV, such as TL-LEND-DS01-SV. |
| `title` | VARCHAR | yes | Its name in code, such as lateFee. |
| `domain_service_id` | VARCHAR → [`domain_service`](#table-domain_service) | yes | The domain service it implements; one service each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |

- **Key:** `id`
- **Unique:** `domain_service_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-ui_component"></a>

### UI component (`ui_component`)

A piece of the user interface that renders one or more views and builds the view requirements its code does (builds). It has no owner: it exists because views use it, and its product follows from its ID.

- **Parents:** none (no owner: it exists because other records use it)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<P>-UI<nn>`, such as `TL-UI01`; it starts with its product's ID
- **Links out:** Builds ([`builds`](#relation-builds)), Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by)), Renders ([`renders`](#relation-renders))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`ui-component-unused`](#check-ui-component-unused), [`view-route-not-in-file`](#check-view-route-not-in-file), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-ui_component"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The UI component's ID: the product prefix and UI<nn>, such as TL-UI01. |
| `title` | VARCHAR | yes | Its name in code, such as CatalogPage. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet. |
| `description` | VARCHAR | yes | What it renders, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-endpoint_handler"></a>

### Endpoint handler (`endpoint_handler`)

Serves its endpoint: reads the request, calls the command or query handler and writes the response.

- **Parents:** [`endpoint`](#kind-endpoint) (`endpoint_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<endpoint>-H`, such as `TL-LEND-EP01-H`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`endpoint-route-not-in-file`](#check-endpoint-route-not-in-file), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-endpoint_handler"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The endpoint handler's ID: its endpoint's ID and H, such as TL-LEND-EP01-H. |
| `title` | VARCHAR | yes | Its name in code, such as postLoan. |
| `endpoint_id` | VARCHAR → [`endpoint`](#table-endpoint) | yes | The endpoint it serves; one endpoint handler each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it reads the request, calls its handler and answers or refuses, in a sentence or two; the request and response shapes belong to the endpoint. |

- **Key:** `id`
- **Unique:** `endpoint_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-adapter"></a>

### Adapter (`adapter`)

Talks to its integration's outside system, so the rest of the code does not.

- **Parents:** [`integration`](#kind-integration) (`integration_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<integration>-AD`, such as `TL-INT01-AD`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))
- **Checks:** [`technical-file-missing`](#check-technical-file-missing), [`package-not-in-manifest`](#check-package-not-in-manifest)

<a id="table-adapter"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The adapter's ID: its integration's ID and AD, such as TL-INT01-AD. |
| `title` | VARCHAR | yes | Its name in code, such as mailer. |
| `integration_id` | VARCHAR → [`integration`](#table-integration) | yes | The integration it talks to; one adapter each. |
| `file` | VARCHAR | no | The file that holds its code, from the product root; it may not exist yet, and several records may share one file. |
| `description` | VARCHAR | yes | How it talks to its outside system, in a sentence or two. |

- **Key:** `id`
- **Unique:** `integration_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-entry_point"></a>

### Entry point (`entry_point`)

A start-up file: what runs first and wires the rest together, such as a server's main file or a desktop app's main process. No design record is implemented by it alone, so it sits under the domain it starts.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<domain>-ENTRY<nn>`, such as `TL-LEND-ENTRY01`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))

<a id="table-entry_point"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The entry point's ID: its domain's ID and ENTRY<nn>, such as TL-LEND-ENTRY01. |
| `title` | VARCHAR | yes | Its file's name, or its name in code, such as server.ts. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it starts. |
| `file` | VARCHAR | no | The start-up file, from the product root; it may not exist yet. |
| `description` | VARCHAR | yes | What it does at start-up, in a sentence or two: what it reads, opens and serves. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-tooling"></a>

### Tooling (`tooling`)

A dev script or config file outside the running product: a build, a generator, a watcher, or a config of the tools it is checked and tested with, such as a type checker's or a test runner's. Its title and file say what it is.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** accidental: what comes from the means used to build it, derived, provided or a fill at a slot
- **Obligation:** no
- **ID:** `<domain>-TOOL<nn>`, such as `TL-LEND-TOOL01`; it starts with its parent's ID
- **Title:** one identifier exactly as in code, with no whitespace (refused otherwise)
- **Links out:** Fills ([`fills`](#relation-fills)), Generates ([`generates`](#relation-generates)), Meets ([`meets`](#relation-meets)), Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Generated by ([`generates`](#relation-generates))

<a id="table-tooling"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The tooling record's ID: its domain's ID and TOOL<nn>, such as TL-LEND-TOOL01. |
| `title` | VARCHAR | yes | Its file's name, such as vitest.config.ts. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain whose code it builds, checks or tests. |
| `file` | VARCHAR | no | The script or config file, or the folder of them, from the product root; it may not exist yet. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-standard"></a>

### Standard (`standard`)

A library of rules that holds across the product, such as exact money, a latency budget, logging, error handling or naming. Its type says whether its rules are essential (a quality) or accidental (engineering). What follows one of its rules meets it.

- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`standard_rule`](#kind-standard_rule)
- **Complexity:** by its type: a quality is essential, engineering accidental
- **Obligation:** no
- **ID:** `<P>-STD-<name>`, such as `TL-STD-CODE`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="table-standard"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The standard's ID, such as TL-STD-CODE. |
| `title` | VARCHAR | yes | The standard's name. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `type` | ENUM('quality', 'engineering') | yes | quality: what the product's people need of it whatever it is built with, such as exact money, auditability or a latency budget (essential); engineering: how it is built, such as logging, naming or how code is laid out (accidental). |
| `description` | VARCHAR | yes | What the standard covers, in a paragraph. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-standard_rule"></a>

### Standard rule (`standard_rule`)

One rule of a standard. Technical records that follow it link to it with meets; its standard rule tests prove it.

- **Parents:** [`standard`](#kind-standard) (`standard_id`)
- **Children:** [`standard_rule_test`](#kind-standard_rule_test)
- **Complexity:** as the record it sits under
- **Obligation:** yes: designed, built and proved
  - **Designed:** A technical record meets it, or a record links to it through a relation the product declared with the design role.
  - **Built:** Every technical record that meets it, and every source of a product relation with the build role, names a file that exists, and there is at least one.
  - **Proved:** One of its standard rule tests, or a source of a product relation with the proof role.
- **ID:** `<standard>-R<nn>`, such as `TL-STD-CODE-R01`; it starts with its parent's ID
- **Links out:** Provided by ([`provided_by`](#relation-provided_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Met by ([`meets`](#relation-meets))
- **Checks:** [`lone-child`](#check-lone-child), [`serves-no-outcome`](#check-serves-no-outcome)

<a id="table-standard_rule"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The rule's ID: its standard's ID and R<nn>, such as TL-STD-CODE-R01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `standard_id` | VARCHAR → [`standard`](#table-standard) | yes | The standard it belongs to. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`

### Checks: technical specification

<a id="check-technical-file-missing"></a>

### `technical-file-missing`

**Warning** · Lathe's · Kinds: [`repository`](#kind-repository), [`data_model`](#kind-data_model), [`table`](#kind-table), [`value_type`](#kind-value_type), [`predicate`](#kind-predicate), [`event_type`](#kind-event_type), [`projection`](#kind-projection), [`command_handler`](#kind-command_handler), [`query_handler`](#kind-query_handler), [`event_handler`](#kind-event_handler), [`service`](#kind-service), [`ui_component`](#kind-ui_component), [`endpoint_handler`](#kind-endpoint_handler), [`adapter`](#kind-adapter)

A technical record whose file does not exist yet.

The technical specification may name a file before it is written, so this is work to do, not breakage: until the file exists, what the record implements is not built. A technical record's file may be a file or a folder of files under the product root. Write the file, or fix the path (relative to the product root).

<a id="check-ui-component-unused"></a>

### `ui-component-unused`

**Error** · Lathe's · Kinds: [`ui_component`](#kind-ui_component)

A ui component that nothing uses.

A ui component has no owner: it exists because it renders views. One that nothing uses is a leftover, or a link is missing. Link the views it renders with renders, or remove it.

<a id="check-table-schema-mismatch"></a>

### `table-schema-mismatch`

**Warning** · Lathe's · Kinds: [`table`](#kind-table)

A table kept in a database whose file does not define it as the spec says: its name, a column or a key.

A table, view or materialized view that names a file is checked against that file read as text (a migration, a SQL schema, or code that creates it): the file defines a table or view of its name; every column its entity's or read model's fields give (a field's column_name, else its name in lower case with underscores; a value object of several fields flattened into its fields' columns; an entity's table also holds the fields of the children kept in its root's table); and each primary, unique and foreign key by its columns, a foreign key also by its target table. It recognizes CREATE TABLE and CREATE VIEW (OR REPLACE, TEMP, MATERIALIZED, IF NOT EXISTS) with their column definitions and inline or table PRIMARY KEY, UNIQUE and REFERENCES, the columns an AS SELECT body selects or names with AS, CREATE UNIQUE INDEX and ALTER TABLE ... ADD. It does not compare types, NOT NULL, CHECKs, a unique key's name or condition, or index keys, and it cannot see a statement built at run time from pieces the text does not show. A missing file is technical-file-missing instead. Change the file to match, or the spec when the file is right.

<a id="check-package-not-in-manifest"></a>

### `package-not-in-manifest`

**Error** · Lathe's · Kinds: [`adapter`](#kind-adapter), [`repository`](#kind-repository), [`data_model`](#kind-data_model), [`table`](#kind-table), [`value_type`](#kind-value_type), [`predicate`](#kind-predicate), [`event_type`](#kind-event_type), [`projection`](#kind-projection), [`command_handler`](#kind-command_handler), [`query_handler`](#kind-query_handler), [`event_handler`](#kind-event_handler), [`service`](#kind-service), [`ui_component`](#kind-ui_component), [`endpoint_handler`](#kind-endpoint_handler)

A record names a package that none of its product's package.json files lists.

A package_use row says a technical record uses a package, so that every dependency is accounted for by what it serves. Naming a package no manifest lists is a stale or mistyped claim: the package was removed, renamed or never added, and the record no longer tells the truth about the code. Fix the name, add the dependency to the package.json the code runs from, or remove the package_use row.

<a id="check-repository-persists-nothing"></a>

### `repository-persists-nothing`

**Error** · Lathe's · Kinds: [`repository`](#kind-repository)

A repository that persists no aggregate.

A repository exists to load and save its aggregate, whole, and says which with its one persists link. One that persists none is a leftover, or its link is missing. Link the aggregate it persists with persists, or remove it.

### Coverage gaps: technical specification

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-aggregate-without-repository"></a>`aggregate-without-repository` | [`aggregate`](#kind-aggregate), [`repository`](#kind-repository) | An aggregate no repository persists. |
| <a id="gap-entity-without-data-model"></a>`entity-without-data-model` | [`entity`](#kind-entity), [`data_model`](#kind-data_model) | An entity with no data model. |
| <a id="gap-entity-without-table"></a>`entity-without-table` | [`entity`](#kind-entity), [`table`](#kind-table) | An entity with no table. |
| <a id="gap-value-object-without-value-type"></a>`value-object-without-value-type` | [`value_object`](#kind-value_object), [`value_type`](#kind-value_type) | A value object with no value type. |
| <a id="gap-event-without-event-type"></a>`event-without-event-type` | [`domain_event`](#kind-domain_event), [`event_type`](#kind-event_type) | A domain event with no event type. |
| <a id="gap-read-model-without-projection"></a>`read-model-without-projection` | [`read_model`](#kind-read_model), [`projection`](#kind-projection) | A read model with no projection. |
| <a id="gap-read-model-without-reader"></a>`read-model-without-reader` | [`read_model`](#kind-read_model), [`reader`](#kind-reader) | A read model with no reader. |
| <a id="gap-read-model-without-table"></a>`read-model-without-table` | [`read_model`](#kind-read_model), [`table`](#kind-table) | A read model with no table. |
| <a id="gap-command-without-handler"></a>`command-without-handler` | [`command`](#kind-command), [`command_handler`](#kind-command_handler) | A command with no command handler. |
| <a id="gap-query-without-handler"></a>`query-without-handler` | [`query`](#kind-query), [`query_handler`](#kind-query_handler) | A query with no query handler. |
| <a id="gap-endpoint-without-handler"></a>`endpoint-without-handler` | [`endpoint`](#kind-endpoint), [`endpoint_handler`](#kind-endpoint_handler) | An endpoint with no endpoint handler. |
| <a id="gap-integration-without-adapter"></a>`integration-without-adapter` | [`integration`](#kind-integration), [`adapter`](#kind-adapter) | An integration with no adapter. |
| <a id="gap-stored-nowhere"></a>`stored-nowhere` | [`repository`](#kind-repository), [`reader`](#kind-reader), [`table`](#kind-table), [`data_store`](#kind-data_store) | A repository, reader or table that names no data store. |
| <a id="gap-data-store-unused"></a>`data-store-unused` | [`data_store`](#kind-data_store), [`repository`](#kind-repository), [`reader`](#kind-reader), [`table`](#kind-table) | A data store no repository, reader or table is stored in. |
| <a id="gap-package-not-accounted-for"></a>`package-not-accounted-for` | [`product`](#kind-product), `package_use` | A product whose package.json files list a package no record of it uses. |
| <a id="gap-table-without-file"></a>`table-without-file` | [`table`](#kind-table) | A table stored in a database table that names no file creating it. |
| <a id="gap-view-without-ui-component"></a>`view-without-ui-component` | [`view`](#kind-view), [`ui_component`](#kind-ui_component) | A view no UI component renders. |
| <a id="gap-code-file-untraced"></a>`code-file-untraced` |  | A source file no technical record names, directly or through a folder. |

<a id="stage-test-plan"></a>

## Test plan

The tests, one kind per thing tested, each proving exactly its parent, and the test data sets they start from.

<a id="kind-test_data_set"></a>

### Test data set (`test_data_set`)

What some tests start from: the environment, the accounts and the starting records, how to prepare and reset them, and the file that builds them. Tests link to it with starts_from.

- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>-<D>-TD<nn>`, such as `TL-LEND-TD01`; it starts with its domain's ID
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Starting point of ([`starts_from`](#relation-starts_from))
- **Checks:** [`test-data-set-unused`](#check-test-data-set-unused), [`test-data-set-file-missing`](#check-test-data-set-file-missing)

<a id="table-test_data_set"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The data set's ID: its domain's ID and TD<nn>, such as TL-LEND-TD01. |
| `title` | VARCHAR | yes | The data set in a few words, such as Two members, one tool on loan. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain whose tests it serves. |
| `environment` | VARCHAR | yes | Where it runs: the database, server or browser storage it is built in. |
| `accounts` | VARCHAR | no | The accounts and roles it signs in as. |
| `records` | VARCHAR | yes | The records it starts with. |
| `prepare` | VARCHAR | yes | How to prepare it before a test. |
| `reset` | VARCHAR | yes | How to reset it after a test, so the next starts clean. |
| `file` | VARCHAR | no | The seed or fixture that builds it, from the product root. |
| `description` | VARCHAR | yes | What it is for, in a sentence or two. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(environment) != '')`
- **Rule:** `("trim"(records) != '')`
- **Rule:** `("trim"("prepare") != '')`
- **Rule:** `("trim"("reset") != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-constraint_test"></a>

### Constraint test (`constraint_test`)

Proves its constraint: the values its value object accepts and refuses.

- **Parents:** [`constraint`](#kind-constraint) (`constraint_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `integration`
- **ID:** `<constraint>-T`, such as `TL-VO01-C01-T`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-constraint_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its constraint's ID and T, such as TL-VO01-C01-T. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `constraint_id` | VARCHAR → [`constraint`](#table-constraint) | yes | The constraint it proves; it has exactly one test. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `accepts` | VARCHAR | yes | Values the value object accepts, such as a@b.org. |
| `refuses` | VARCHAR | yes | Values it refuses, and how. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `constraint_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"(accepts) != '')`
- **Rule:** `("trim"(refuses) != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-invariant_test"></a>

### Invariant test (`invariant_test`)

Proves its invariant: a change that would break it is refused, and the aggregate stays as it was.

- **Parents:** [`invariant`](#kind-invariant) (`invariant_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `integration`
- **ID:** `<invariant>-T`, such as `TL-LEND-INV01-T`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-invariant_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its invariant's ID and T, such as TL-LEND-INV01-T. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `invariant_id` | VARCHAR → [`invariant`](#table-invariant) | yes | The invariant it proves; it has exactly one test. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `invariant_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-specification_test"></a>

### Specification test (`specification_test`)

Proves its specification: which records satisfy the predicate and which do not.

- **Parents:** [`specification`](#kind-specification) (`specification_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `integration`
- **ID:** `<specification>-T`, such as `TL-LEND-SP01-T`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-specification_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its specification's ID and T, such as TL-LEND-SP01-T. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `specification_id` | VARCHAR → [`specification`](#table-specification) | yes | The specification it proves; it has exactly one test. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `specification_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-policy_test"></a>

### Policy test (`policy_test`)

Proves its policy: when its event happens, its command is sent.

- **Parents:** [`policy`](#kind-policy) (`policy_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `integration`, `service`, `system`, `browser`
- **ID:** `<policy>-T`, such as `TL-LEND-PO01-T`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-policy_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its policy's ID and T, such as TL-LEND-PO01-T. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `policy_id` | VARCHAR → [`policy`](#table-policy) | yes | The policy it proves; it has exactly one test. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `policy_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-domain_service_test"></a>

### Domain service test (`domain_service_test`)

Proves its domain service: from the inputs given, the value or decision it returns.

- **Parents:** [`domain_service`](#kind-domain_service) (`domain_service_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`
- **ID:** `<domain service>-T<nn>`, such as `TL-LEND-DS01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-domain_service_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its domain service's ID and T<nn>, such as TL-LEND-DS01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `domain_service_id` | VARCHAR → [`domain_service`](#table-domain_service) | yes | The domain service it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-storage_requirement_test"></a>

### Storage requirement test (`storage_requirement_test`)

Proves its storage requirement at the level that can observe it: a round trip, a restart, a failed save that leaves nothing behind, a deletion, a restore.

- **Parents:** [`storage_requirement`](#kind-storage_requirement) (`storage_requirement_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `integration`, `service`, `system`, `browser`
- **ID:** `<storage requirement>-T<nn>`, such as `TL-LEND-A1-SR01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))

<a id="table-storage_requirement_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its storage requirement's ID and T<nn>, such as TL-LEND-A1-SR01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `storage_requirement_id` | VARCHAR → [`storage_requirement`](#table-storage_requirement) | yes | The storage requirement it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-use_case_test"></a>

### Use case test (`use_case_test`)

Proves its UC requirement, at the level the use case is stated: what the actor does and what the product does in answer.

- **Parents:** [`uc_requirement`](#kind-uc_requirement) (`uc_requirement_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `service`, `system`, `browser`
- **ID:** `<UC requirement>-T<nn>`, such as `TL-LEND-UC01-R01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-use_case_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its UC requirement's ID and T<nn>, such as TL-LEND-UC01-R01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `uc_requirement_id` | VARCHAR → [`uc_requirement`](#table-uc_requirement) | yes | The UC requirement it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-view_test"></a>

### View test (`view_test`)

Proves its view requirement in the view.

- **Parents:** [`view_requirement`](#kind-view_requirement) (`view_requirement_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `browser`
- **ID:** `<view requirement>-T<nn>`, such as `TL-V01-R01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-view_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its view requirement's ID and T<nn>, such as TL-V01-R01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `view_requirement_id` | VARCHAR → [`view_requirement`](#table-view_requirement) | yes | The view requirement it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-endpoint_test"></a>

### Endpoint test (`endpoint_test`)

Proves its API requirement at the endpoint: the request and the response.

- **Parents:** [`api_requirement`](#kind-api_requirement) (`api_requirement_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `service`, `system`
- **ID:** `<API requirement>-T<nn>`, such as `TL-LEND-EP01-R01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-endpoint_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its API requirement's ID and T<nn>, such as TL-LEND-EP01-R01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `api_requirement_id` | VARCHAR → [`api_requirement`](#table-api_requirement) | yes | The API requirement it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-flow_test"></a>

### Flow test (`flow_test`)

The use case's acceptance test: its flow's main path, end to end, through any one interface that offers the use case, at the level that fits that interface (browser for a web app or desktop, system for an API, a CLI or agent tools). How each other interface carries a step out is proved once per rule and domain by its pattern's rule tests, never per use case.

- **Parents:** [`flow`](#kind-flow) (`flow_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `system`, `browser`
- **ID:** `<flow>-T`, such as `TL-LEND-UC01-FL-T`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-flow_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its flow's ID and T, such as TL-LEND-UC01-FL-T. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `flow_id` | VARCHAR → [`flow`](#table-flow) | yes | The flow it proves; it has exactly one test. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `steps` | VARCHAR[] | yes | What the test does along the main path, step by step. |
| `expected_result` | VARCHAR | yes | What it expects at the end. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `flow_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `(len(steps) >= 1)`
- **Rule:** `("trim"(expected_result) != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-integration_test"></a>

### Integration test (`integration_test`)

Proves an exchange with its integration's outside system.

- **Parents:** [`integration`](#kind-integration) (`integration_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `integration`, `service`, `system`
- **ID:** `<integration>-T<nn>`, such as `TL-INT01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-integration_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its integration's ID and T<nn>, such as TL-INT01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `integration_id` | VARCHAR → [`integration`](#table-integration) | yes | The integration it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-pattern_rule_test"></a>

### Pattern rule test (`pattern_rule_test`)

Proves its pattern rule in one domain that adopts the pattern: one test per pattern rule and adopting domain.

- **Parents:** [`pattern_rule`](#kind-pattern_rule) (`pattern_rule_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `integration`, `service`, `system`, `browser`
- **ID:** `<pattern rule>-T<nn>`, such as `TL-PAT-ACT-R01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-level-not-allowed`](#check-test-level-not-allowed), [`pattern-rule-test-outside-followers`](#check-pattern-rule-test-outside-followers), [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-pattern_rule_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its pattern rule's ID and T<nn>, such as TL-PAT-ACT-R01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `pattern_rule_id` | VARCHAR → [`pattern_rule`](#table-pattern_rule) | yes | The pattern rule it proves. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it proves the rule in, one that follows the pattern itself or through a use case; one test per pattern rule and domain. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Unique:** `pattern_rule_id`, `domain_id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

<a id="kind-standard_rule_test"></a>

### Standard rule test (`standard_rule_test`)

Proves its standard rule in the product's code, such as a scan of the code for what the rule forbids or a test of a place that follows it.

- **Parents:** [`standard_rule`](#kind-standard_rule) (`standard_rule_id`)
- **Children:** none
- **Complexity:** as the record it sits under
- **Obligation:** no
- **Run by levels:** `unit`, `integration`, `service`, `system`, `browser`
- **ID:** `<standard rule>-T<nn>`, such as `TL-STD-CODE-R01-T01`; it starts with its parent's ID
- **Links out:** Starts from ([`starts_from`](#relation-starts_from))
- **Links in:** Questions about this ([`about`](#relation-about)), Measures ([`measured_by`](#relation-measured_by))
- **Checks:** [`test-case-unnamed`](#check-test-case-unnamed), [`test-title-not-a-result`](#check-test-title-not-a-result)

<a id="table-standard_rule_test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID: its standard rule's ID and T<nn>, such as TL-STD-CODE-R01-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `standard_rule_id` | VARCHAR → [`standard_rule`](#table-standard_rule) | yes | The standard rule it proves. |
| `level` | ENUM('unit', 'integration', 'service', 'system', 'browser') | yes | How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. |
| `state` | ENUM('automated', 'manual', 'not automated yet') | yes | automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `manual_reason` | VARCHAR | no | Why a person runs it rather than a file; a manual test must give one, and only a manual test. |
| `size` | ENUM('volume', 'worst case') | no | How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). |
| `smoke` | BOOLEAN | no | Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. |
| `external` | BOOLEAN | no | Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. |
| `when` | VARCHAR | yes | What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). |
| `then` | VARCHAR | yes | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as when to run it. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `smoke`
- **Rule:** `"external"`
- **Rule:** `("trim"("when") != '')`
- **Rule:** `("trim"("then") != '')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((state = 'manual') = (manual_reason IS NOT NULL))`

### Checks: test plan

<a id="check-test-file-missing"></a>

### `test-file-missing`

**Error or warning** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test)

A test's `file` exists, and so does that of a product kind's record that proves an obligation.

For an automated or manual test a missing file is an error. A test that is not automated yet may name the file it will live in, so for it a missing file is a warning. The file must be a file under the product root, never a folder. A record of a product's own kind that proves an obligation and names a file is checked as an automated test is. Fix the path (relative to the product root), or write the file.

<a id="check-test-file-missing-id"></a>

### `test-file-missing-id`

**Error** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test)

An automated test's file names the test, and so does that of a product kind's record that proves an obligation, so the code can be traced back to it.

A test proves exactly its parent, and its file names the test's own ID as a whole ID (TL-LEND-INV01-T, not inside TL-LEND-INV01-T2), so a reader of the code finds the record and a reader of the record finds the code. Until it does, the test proves nothing. A missing file is test-file-missing instead; manual tests and tests not automated yet are not checked here. A record of a product's own kind that proves an obligation and names a file is held to the same rule, since it counts as proof only when its file names it. Put the test's ID in the test's name in the file.

<a id="check-manual-test-file-silent"></a>

### `manual-test-file-silent`

**Warning** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test)

A manual test whose file exists but never mentions it.

A manual test may name a file that holds the steps a person follows. Nothing ties that file to the test until it names the test's ID. Manual tests are not held to the automated rule (test-file-missing-id), so a silent file is a warning. Name the test in the file, or point its `file` at the file that carries it out.

<a id="check-test-level-not-allowed"></a>

### `test-level-not-allowed`

**Warning** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test)

A test whose run by level its test kind does not allow.

A test's level says only how it runs, cheapest first: unit (in process, no storage or I/O), integration (in process, with real storage: a database, files, git), service (through the product's interface in process, with real storage), system (the running product driven from outside through its real interface) and browser (a real browser or the desktop shell against the running app); a manual test names the level a person exercises. Each test kind is run at the levels that can prove what it tests, and a test runs at the lowest of them that can observe its result: a constraint test at unit or integration (a constraint enforced by a SQL CHECK can only be tested against the database); an invariant or specification test at unit or integration; a domain service test at unit; a policy test at integration, service or system, or at browser where only the running app shows the reaction; a use case test at service, system or browser; a view test at unit or browser; an endpoint test at service or system; a flow test at system or browser (and at the one that fits its flow's interface, flow-test-level-for-interface); an integration test at integration, service or system; a pattern rule or standard rule test at any level. A test at another level proves nothing in coverage. Run the test at an allowed level and set its level, or make it the test kind of what it really proves.

<a id="check-pattern-rule-test-outside-followers"></a>

### `pattern-rule-test-outside-followers`

**Error** · Lathe's · Kinds: [`pattern_rule_test`](#kind-pattern_rule_test), [`pattern_rule`](#kind-pattern_rule), [`domain`](#kind-domain)

A pattern rule test names a domain that follows its pattern.

A pattern rule test proves its rule in one domain that follows the pattern: the domain itself follows it, or one of its use cases does, and every such domain owes every rule of the pattern. A test naming a domain that does not follow the pattern proves the rule where nothing owes it. Name a domain that follows the pattern, link the domain or its use case to the pattern with `follows`, or remove the test.

<a id="check-test-data-set-unused"></a>

### `test-data-set-unused`

**Error** · Lathe's · Kinds: [`test_data_set`](#kind-test_data_set)

A test data set that no test starts from.

A test data set exists because tests start from it: it is prepared before them and reset after. One that no test starts from is a leftover, or a link is missing. Link the tests that start from it with starts_from, or remove it.

<a id="check-test-data-set-file-missing"></a>

### `test-data-set-file-missing`

**Error or warning** · Lathe's · Kinds: [`test_data_set`](#kind-test_data_set)

A test data set whose file does not exist.

A test data set's file is the seed or fixture that builds it, a file or a folder of files under the product root. When an automated test starts from it, a missing file means that test cannot run, so it is an error. Otherwise the plan may name the file before it is written, so it is a warning. Write the file, or fix the path (relative to the product root).

<a id="check-test-case-unnamed"></a>

### `test-case-unnamed`

**Error** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test), [`standard_rule_test`](#kind-standard_rule_test)

A test case in the product's test files names a test whose file it is in, so every test in the code leads back to the record it proves.

test-file-missing-id follows a test record to its code; this check follows the code back. The engine reads the product's test files (those matching the tests globs in lathe.config.json, by default **/*.test.{ts,tsx,js,mjs} and **/*.spec.{ts,tsx,js}, never in node_modules, dist or another product's folder, and every file a test record names) as text and finds each test case: a call of it or test, with its modifiers and each forms, whose name is a string or template literal, inside the describe calls around it. A test case must name, in its own name, its describes' names or its each rows, the ID of a test (or of a product kind's record that proves an obligation) whose file is the file it is in. One that names none proves nothing anyone can find. Start its name, or its describe's, with the ID of the test it proves, adding that test when the spec lacks it, or remove the test case if it proves nothing.

<a id="check-test-title-not-a-result"></a>

### `test-title-not-a-result`

**Warning** · Lathe's · Kinds: [`constraint_test`](#kind-constraint_test), [`invariant_test`](#kind-invariant_test), [`specification_test`](#kind-specification_test), [`policy_test`](#kind-policy_test), [`domain_service_test`](#kind-domain_service_test), [`use_case_test`](#kind-use_case_test), [`view_test`](#kind-view_test), [`endpoint_test`](#kind-endpoint_test), [`flow_test`](#kind-flow_test), [`integration_test`](#kind-integration_test), [`pattern_rule_test`](#kind-pattern_rule_test), [`standard_rule_test`](#kind-standard_rule_test)

A test titled by what it does or ought to do, starting with "Tests that" or "Should", rather than by the result it shows.

A test's title is the observable result it shows, one short sentence that is true when the test passes, such as "An overdue loan is refused a renewal": a reader of the test plan learns what holds without opening the test. A title that starts with "Tests that", "Test that", "Tests whether", "Tests if" or "Should" says what the test checks or hopes for instead. A title that only starts with the noun "Tests", such as "Tests run in order", is not read. Rewrite the title as the result.

### Coverage gaps: test plan

Each is reported in coverage, under the record that falls short, never as a problem.

| Gap | Kinds | What it reports |
| --- | --- | --- |
| <a id="gap-flow-without-test"></a>`flow-without-test` | [`flow`](#kind-flow), [`flow_test`](#kind-flow_test) | A flow with no flow test of its main path. |

## Outside the stages

The product, the roles its records name and its open questions, which belong to no stage.

<a id="kind-product"></a>

### Product (`product`)

A product: the root of a set of specifications.

- **Parents:** none (a root record)
- **Children:** [`business_outcome`](#kind-business_outcome), [`domain`](#kind-domain), [`pattern`](#kind-pattern), [`interface`](#kind-interface), [`data_store`](#kind-data_store), [`standard`](#kind-standard), [`question`](#kind-question)
- **Complexity:** essential: what the problem itself demands, decided once per product
- **Obligation:** no
- **ID:** `<P>`, such as `TL`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`role`](#table-role)
- **Gaps:** [`route-without-record`](#gap-route-without-record), [`package-not-accounted-for`](#gap-package-not-accounted-for)

<a id="table-product"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The product's ID, its prefix, such as TL. |
| `title` | VARCHAR | yes | The product's name, such as Tool Library. |
| `description` | VARCHAR | yes | What the product is, who it is for and what it must do, in a paragraph. |
| `icon` | VARCHAR | no | An emoji or short text shown for the product in the app's space rail. |
| `color` | VARCHAR | no | A CSS color for the product in the app's space rail. |
| `notes` | VARCHAR | no | Longer notes on the product, such as how it is delivered. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-role"></a>

#### `role`

A role the product's records name, such as Owner, Reader or Agent: a use case's actors and a question's owner. Specs name roles, never people.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product. |
| `name` | VARCHAR | yes | The role's name, such as Librarian. |
| `description` | VARCHAR | yes | Who takes the role and what they do in the product, in a sentence. |

- **Key:** `product_id`, `name`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(description) != '')`

<a id="kind-question"></a>

### Open question (`question`)

Something undecided, with the role that decides it. It sits under its product or one of its domains, and may be about any record (the about link). A decided question is removed and its answer written into the records it affects.

- **Parents:** [`product`](#kind-product) (`product_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<P>-Q<nn> or <P>-<D>-Q<nn>`, such as `TL-LEND-Q01`; it starts with its parent's ID
- **Links out:** About ([`about`](#relation-about))
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="table-question"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The question's ID: its product's or domain's ID and Q<nn>, such as TL-LEND-Q01 or TL-Q01. |
| `title` | VARCHAR | yes | The question. |
| `product_id` | VARCHAR → [`product`](#table-product) | no | The product it sits under, for a question of the whole product; exactly one of product and domain is given. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | no | The domain it sits under; exactly one of product and domain is given. |
| `owner` | VARCHAR | yes | The role that decides it, one of the product's roles, such as Owner. |
| `description` | VARCHAR | yes | What is open and the options, in a paragraph. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("owner") != '')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `((product_id IS NULL) != (domain_id IS NULL))`

## Other tables

The tables that are not a kind of record or one of its parts, and are kept in data files.

### Declaration tables: a product's own kinds and relations.

<a id="table-product_kind"></a>

#### `product_kind`

A kind a product adds to Lathe's, such as a report or a CLI command. Its records sit under one parent kind, and its fields are product_kind_field rows.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | VARCHAR | yes | The kind's name, in lower case with underscores, which is also its table's name; it must not be a table Lathe already has. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product that declares it; only that product's records may be of the kind. |
| `label` | VARCHAR | yes | The kind's name as people read it, such as Report. |
| `description` | VARCHAR | yes | What a record of the kind is. |
| `parent_kind` | VARCHAR | yes | The kind its records sit under, their one parent: one of Lathe's or another product kind. Its table gets a required <parent_kind>_id column. |
| `stage` | ENUM('discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan') | no | The stage its records belong to, any of the six, if one; such as technical-specification for a kind of code Lathe has no kind for. |
| `obligation` | BOOLEAN | yes | Whether a record of the kind is an obligation, to be designed, built and proved. An obligation kind joins the obligation supertype, and the records something outside the product may provide (provided_by_source). |
| `id_pattern` | VARCHAR | no | How its IDs are written, its own pattern, such as <command>-CLI. |
| `id_example` | VARCHAR | no | An example ID. |
| `title_form` | ENUM('identifier', 'invocation', 'kebab-case') | no | For a code-bound kind, how its titles are written (meta_kind_title): identifier, invocation or kebab-case; none for a kind titled in words. |
| `complexity` | ENUM('essential', 'accidental', 'as-parent', 'by-type', 'by-interface') | yes | Whether its records are essential complexity (what the problem itself demands, such as a report the product's people read), accidental (what comes from the means of building it, such as a kind of code), or as-parent: as the record they sit under. Never mixed: a kind that would hold both is two kinds. |

- **Key:** `name`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"("label") != '')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `(NOT (complexity IN ('by-type', 'by-interface')))`

<a id="table-product_kind_field"></a>

#### `product_kind_field`

One typed field of a product kind, in order: a column of its table.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `kind` | VARCHAR → [`product_kind`](#table-product_kind) | yes | The product kind. |
| `position` | INTEGER | yes | The field's place among the kind's columns, from 1. |
| `name` | VARCHAR | yes | The column's name, in lower case with underscores; not id, title or the parent column. A field named statement, goal, meaning or description is the kind's lead text, shown first on its records' pages: a kind has at most one, and it must be required. |
| `type` | ENUM('text', 'integer', 'boolean', 'date') | yes | text, integer, boolean or date (YYYY-MM-DD). |
| `required` | BOOLEAN | yes | Whether every record of the kind must give it. |
| `description` | VARCHAR | yes | What the field holds. |
| `titles` | BOOLEAN | no | Whether the field's value is also the record's title, such as a module's file: every write sets the title from it, and a title that differs is refused. Only a required text field titles its kind, and at most one does. |

- **Key:** `kind`, `position`
- **Unique:** `kind`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"(description) != '')`
- **Rule:** `titles`

<a id="table-product_relation"></a>

#### `product_relation`

A pair of kinds a product lets a relation link. A new relation name gets its own link table; a name Lathe already has adds the pair to that relation, when its link table's ends accept the two kinds.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | VARCHAR | yes | The relation's name, in lower case with underscores. |
| `source_kind` | VARCHAR | yes | The kind a link starts from. |
| `target_kind` | VARCHAR | yes | The kind a link points at, or * for any record. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product that declares it. |
| `role` | ENUM('design', 'build', 'proof') | no | design, build or proof, for a new relation that counts toward coverage: a design or build link's source builds its target once it names a file that exists, and a proof link's source proves it. A new relation's links stay inside one product. |
| `forward_label` | VARCHAR | yes | The link read from its source. |
| `reverse_label` | VARCHAR | yes | The link read from its target. |
| `description` | VARCHAR | yes | What a link between these kinds means. |

- **Key:** `name`, `source_kind`, `target_kind`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"(forward_label) != '')`
- **Rule:** `("trim"(reverse_label) != '')`
- **Rule:** `("trim"(description) != '')`

### Checking tables: the checks and their settings.

<a id="table-check"></a>

#### `check`

A check: a query over the tables that returns a row (severity, check, record, message) for each problem it finds. An error means the workspace is broken; a warning is work still to do.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | VARCHAR | yes | The check's name, in lower case with hyphens, such as value-object-unused. |
| `product_id` | VARCHAR → [`product`](#table-product) | no | For a product's own check, the product; none for Lathe's checks. |
| `domain_id` | VARCHAR | yes | The domain whose rules it reports: a domain of Lathe's own spec for Lathe's checks, of the product for its own. Not a foreign key, because Lathe's checks load into every product. |
| `position` | INTEGER | yes | Its place in the run order, from 1: Lathe's checks run first, then the product's own. |
| `severity` | ENUM('error', 'warning', 'error_or_warning') | yes | What its rows report: error, warning, or error_or_warning when its rows say which. |
| `summary` | VARCHAR | yes | What it reports, in one sentence. |
| `explanation` | VARCHAR | yes | Why it matters, ending with how to fix what it reports. |
| `query` | VARCHAR | yes | The SELECT that finds the problems. |
| `kinds` | VARCHAR[] | no | The kinds it concerns. |

- **Key:** `name`
- **Rule:** `regexp_full_match("name", '[a-z0-9]+(-[a-z0-9]+)*')`
- **Rule:** `("trim"(domain_id) != '')`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"(summary) != '')`
- **Rule:** `("trim"(explanation) != '')`
- **Rule:** `("trim"(query) != '')`

<a id="table-product_setting"></a>

#### `product_setting`

A product's typed settings for its checks. A product without a row takes the defaults.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product. |
| `max_children` | INTEGER | yes | The most children of one kind a record should have before too-many-children warns; the default is 15. |
| `max_entities_per_aggregate` | INTEGER | yes | The most entities an aggregate should have before aggregate-too-large warns; the default is 7. |
| `technology_words` | VARCHAR[] | yes | The words, besides Lathe's own, that name technology in this product's essential records, which accidental-in-essential warns of, such as the name of a framework the product is built with; none by default. |

- **Key:** `product_id`
- **Rule:** `(max_children >= 1)`
- **Rule:** `(max_entities_per_aggregate >= 1)`

### Other part tables: rows that belong to one record and are removed with it.

<a id="table-package_use"></a>

#### `package_use`

A package a technical record uses: a dependency one of the product's package.json files lists, which the record accounts for, such as the package an adapter calls or a tooling record runs. Only a technical record names one: its record_id is one (technical_record).

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `record_id` | VARCHAR → `technical_record` | yes | The technical record that uses the package: an adapter, a UI component, an entry point, a tooling record, or a record of a product's own technical kind. |
| `package` | VARCHAR | yes | The package's name as package.json lists it, such as @duckdb/node-api. |

- **Key:** `record_id`, `package`
- **Rule:** `regexp_full_match(package, '(@[a-z0-9~-][a-z0-9._~-]*/)?[a-z0-9~-][a-z0-9._~-]*')`

<a id="table-setting_value"></a>

#### `setting_value`

The value a use case or domain gives one setting of a pattern it follows. A follower owes every rule of the pattern; a value such as No input is a value like any other, never a way out of a rule.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `follower_id` | VARCHAR | yes | The use case or domain that follows the pattern. |
| `pattern_id` | VARCHAR | yes | The pattern it follows. |
| `setting` | VARCHAR | yes | The setting, one of the pattern's. |
| `value` | VARCHAR | yes | The value it gives the setting. |

- **Key:** `follower_id`, `pattern_id`, `setting`
- **Foreign key:** `(follower_id, pattern_id) -> follows (source_id, target_id)`
- **Foreign key:** `(pattern_id, setting) -> pattern_setting (pattern_id, name)`
- **Rule:** `("trim"("value") != '')`

## Relations

Every relation: a link is a row (`source_id`, `target_id`) of the table named after it. Which kinds it may link, what the link does, and the words it reads as from the source (forward) and from the target (reverse).

<a id="relation-about"></a>

### `about`

The open question concerns the record.

- **Reads:** About / Questions about this
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`question`](#kind-question) | any record | The open question concerns that record. |

<a id="relation-builds"></a>

### `builds`

The UI component builds the view requirement: its code does what the requirement says. A view requirement is built only through the components that build it, never through any component that renders its view.

- **Reads:** Builds / Built by
- **Role:** build

| From | To | Meaning |
| --- | --- | --- |
| [`ui_component`](#kind-ui_component) | [`view_requirement`](#kind-view_requirement) | The UI component's code does what the view requirement says. |

<a id="relation-builds_on"></a>

### `builds_on`

The term is defined with the other term: its meaning uses it, so the other term is defined first and never builds on it in turn, through any chain.

- **Reads:** Builds on / Built on by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`term`](#kind-term) | [`term`](#kind-term) | The term's meaning uses the other term, which is defined before it. |

<a id="relation-calls"></a>

### `calls`

The command, query or read model uses the domain service, of its own domain.

- **Reads:** Calls / Called by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`command`](#kind-command) | [`domain_service`](#kind-domain_service) | The command uses the domain service. |
| [`query`](#kind-query) | [`domain_service`](#kind-domain_service) | The query uses the domain service. |
| [`read_model`](#kind-read_model) | [`domain_service`](#kind-domain_service) | The read model's projection uses the domain service. |

<a id="relation-checks"></a>

### `checks`

The command checks the specification, of its own domain, before it acts.

- **Reads:** Checks / Checked by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`command`](#kind-command) | [`specification`](#kind-specification) | The command checks the specification before it acts. |

<a id="relation-exchanges_with"></a>

### `exchanges_with`

The flow step exchanges with the integration's outside system.

- **Reads:** Exchanges with / Exchanged with by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`flow_step`](#kind-flow_step) | [`integration`](#kind-integration) | The step exchanges with the outside system. |

<a id="relation-fed_by"></a>

### `fed_by`

The read model is kept current from the event: of its own domain, or another domain's published one, which is how a read model shows another domain's data.

- **Reads:** Fed by / Feeds
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`read_model`](#kind-read_model) | [`domain_event`](#kind-domain_event) | The read model is kept current from the event. |

<a id="relation-fills"></a>

### `fills`

The accidental record (a technical record or an endpoint), written by hand, fills the pattern's slot against its contract: it is a fill, accidental complexity recorded where it is owed and counted as debt until the pattern can derive it. A record of a product's own accidental kind, such as a shared module, fills a slot the same way, with no declaration.

- **Reads:** Fills / Filled by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`adapter`](#kind-adapter) | [`slot`](#kind-slot) | The adapter, written by hand, fills the slot. |
| [`command_handler`](#kind-command_handler) | [`slot`](#kind-slot) | The command handler, written by hand, fills the slot. |
| [`data_model`](#kind-data_model) | [`slot`](#kind-slot) | The data model, written by hand, fills the slot. |
| [`endpoint`](#kind-endpoint) | [`slot`](#kind-slot) | The endpoint, written by hand, fills the slot. |
| [`endpoint_handler`](#kind-endpoint_handler) | [`slot`](#kind-slot) | The endpoint handler, written by hand, fills the slot. |
| [`entry_point`](#kind-entry_point) | [`slot`](#kind-slot) | The entry point, written by hand, fills the slot. |
| [`event_handler`](#kind-event_handler) | [`slot`](#kind-slot) | The event handler, written by hand, fills the slot. |
| [`event_type`](#kind-event_type) | [`slot`](#kind-slot) | The event type, written by hand, fills the slot. |
| [`predicate`](#kind-predicate) | [`slot`](#kind-slot) | The predicate, written by hand, fills the slot. |
| [`projection`](#kind-projection) | [`slot`](#kind-slot) | The projection, written by hand, fills the slot. |
| [`query_handler`](#kind-query_handler) | [`slot`](#kind-slot) | The query handler, written by hand, fills the slot. |
| [`reader`](#kind-reader) | [`slot`](#kind-slot) | The reader, written by hand, fills the slot. |
| [`repository`](#kind-repository) | [`slot`](#kind-slot) | The repository, written by hand, fills the slot. |
| [`rule`](#kind-rule) | [`slot`](#kind-slot) | The rule, written by hand, fills the slot. |
| [`service`](#kind-service) | [`slot`](#kind-slot) | The service, written by hand, fills the slot. |
| [`table`](#kind-table) | [`slot`](#kind-slot) | The table, written by hand, fills the slot. |
| [`tooling`](#kind-tooling) | [`slot`](#kind-slot) | The tooling, written by hand, fills the slot. |
| [`ui_component`](#kind-ui_component) | [`slot`](#kind-slot) | The UI component, written by hand, fills the slot. |
| [`value_type`](#kind-value_type) | [`slot`](#kind-slot) | The value type, written by hand, fills the slot. |

<a id="relation-follows"></a>

### `follows`

The domain, use case or interface follows the pattern, and gives a value for each of its settings in setting_value rows. An interface's pattern says how a step is carried out through it, and every domain with a use case the interface offers owes its rules.

- **Reads:** Follows / Followed by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`domain`](#kind-domain) | [`pattern`](#kind-pattern) | The whole domain follows the pattern, and so owes each of its rules. |
| [`interface`](#kind-interface) | [`pattern`](#kind-pattern) | Each step through the interface is carried out as the pattern says. |
| [`use_case`](#kind-use_case) | [`pattern`](#kind-pattern) | The use case follows the pattern and gives a value for each of its settings. |

<a id="relation-fulfills"></a>

### `fulfills`

The flow step fulfills the UC requirement, of its own use case; this designs the requirement.

- **Reads:** Fulfills / Fulfilled by
- **Role:** design

| From | To | Meaning |
| --- | --- | --- |
| [`flow_step`](#kind-flow_step) | [`uc_requirement`](#kind-uc_requirement) | The step fulfills the UC requirement of its use case. |

<a id="relation-generates"></a>

### `generates`

The tooling record (a generator) writes the accidental record (a technical record's code, or an endpoint's route) from the spec: the record is derived, never written by hand. A record of a product's own accidental kind, such as a shared module, is generated the same way, with no declaration.

- **Reads:** Generates / Generated by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`tooling`](#kind-tooling) | [`adapter`](#kind-adapter) | The tooling record generates the adapter's code. |
| [`tooling`](#kind-tooling) | [`command_handler`](#kind-command_handler) | The tooling record generates the command handler's code. |
| [`tooling`](#kind-tooling) | [`data_model`](#kind-data_model) | The tooling record generates the data model's code. |
| [`tooling`](#kind-tooling) | [`endpoint`](#kind-endpoint) | The tooling record generates the endpoint's code. |
| [`tooling`](#kind-tooling) | [`endpoint_handler`](#kind-endpoint_handler) | The tooling record generates the endpoint handler's code. |
| [`tooling`](#kind-tooling) | [`entry_point`](#kind-entry_point) | The tooling record generates the entry point's code. |
| [`tooling`](#kind-tooling) | [`event_handler`](#kind-event_handler) | The tooling record generates the event handler's code. |
| [`tooling`](#kind-tooling) | [`event_type`](#kind-event_type) | The tooling record generates the event type's code. |
| [`tooling`](#kind-tooling) | [`predicate`](#kind-predicate) | The tooling record generates the predicate's code. |
| [`tooling`](#kind-tooling) | [`projection`](#kind-projection) | The tooling record generates the projection's code. |
| [`tooling`](#kind-tooling) | [`query_handler`](#kind-query_handler) | The tooling record generates the query handler's code. |
| [`tooling`](#kind-tooling) | [`reader`](#kind-reader) | The tooling record generates the reader's code. |
| [`tooling`](#kind-tooling) | [`repository`](#kind-repository) | The tooling record generates the repository's code. |
| [`tooling`](#kind-tooling) | [`rule`](#kind-rule) | The tooling record generates the rule's code. |
| [`tooling`](#kind-tooling) | [`service`](#kind-service) | The tooling record generates the service's code. |
| [`tooling`](#kind-tooling) | [`table`](#kind-table) | The tooling record generates the table's code. |
| [`tooling`](#kind-tooling) | [`tooling`](#kind-tooling) | The tooling record generates the tooling's code. |
| [`tooling`](#kind-tooling) | [`ui_component`](#kind-ui_component) | The tooling record generates the UI component's code. |
| [`tooling`](#kind-tooling) | [`value_type`](#kind-value_type) | The tooling record generates the value type's code. |

<a id="relation-has_many"></a>

### `has_many`

The entity holds any number of the other entity, as parts of it (one to many).

- **Reads:** Has many / Part of
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | The entity holds any number of the other entity, as parts of it (one to many). |

<a id="relation-has_one"></a>

### `has_one`

The entity holds exactly one of the other entity, as a part of it (one to one).

- **Reads:** Has one / Part of
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | The entity holds exactly one of the other entity, as a part of it (one to one). |

<a id="relation-hears"></a>

### `hears`

The policy hears the event: one event per policy, of its own domain or another domain's published one.

- **Reads:** Hears / Heard by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`policy`](#kind-policy) | [`domain_event`](#kind-domain_event) | Whenever the event happens, the policy sends its command. |

<a id="relation-invokes"></a>

### `invokes`

The flow step invokes the command or query: at most one per step.

- **Reads:** Invokes / Invoked by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`flow_step`](#kind-flow_step) | [`command`](#kind-command) | The step sends the command. |
| [`flow_step`](#kind-flow_step) | [`query`](#kind-query) | The step asks the query. |

<a id="relation-measured_by"></a>

### `measured_by`

The business outcome is measured by the test or record: a test of any kind, or a record of a product's own kind (a report, a script, a check row) once the product adds that pair with a product_relation named measured_by. An outcome may be measured by several, and one test or record measure several outcomes.

- **Reads:** Measured by / Measures
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`business_outcome`](#kind-business_outcome) | [`constraint_test`](#kind-constraint_test) | The business outcome is measured by the constraint test. |
| [`business_outcome`](#kind-business_outcome) | [`domain_service_test`](#kind-domain_service_test) | The business outcome is measured by the domain service test. |
| [`business_outcome`](#kind-business_outcome) | [`endpoint_test`](#kind-endpoint_test) | The business outcome is measured by the endpoint test. |
| [`business_outcome`](#kind-business_outcome) | [`flow_test`](#kind-flow_test) | The business outcome is measured by the flow test. |
| [`business_outcome`](#kind-business_outcome) | [`integration_test`](#kind-integration_test) | The business outcome is measured by the integration test. |
| [`business_outcome`](#kind-business_outcome) | [`invariant_test`](#kind-invariant_test) | The business outcome is measured by the invariant test. |
| [`business_outcome`](#kind-business_outcome) | [`pattern_rule_test`](#kind-pattern_rule_test) | The business outcome is measured by the pattern rule test. |
| [`business_outcome`](#kind-business_outcome) | [`policy_test`](#kind-policy_test) | The business outcome is measured by the policy test. |
| [`business_outcome`](#kind-business_outcome) | [`specification_test`](#kind-specification_test) | The business outcome is measured by the specification test. |
| [`business_outcome`](#kind-business_outcome) | [`standard_rule_test`](#kind-standard_rule_test) | The business outcome is measured by the standard rule test. |
| [`business_outcome`](#kind-business_outcome) | [`storage_requirement_test`](#kind-storage_requirement_test) | The business outcome is measured by the storage requirement test. |
| [`business_outcome`](#kind-business_outcome) | [`use_case_test`](#kind-use_case_test) | The business outcome is measured by the use case test. |
| [`business_outcome`](#kind-business_outcome) | [`view_test`](#kind-view_test) | The business outcome is measured by the view test. |

<a id="relation-meets"></a>

### `meets`

The technical record follows the standard rule: it shows where the rule is applied, and designs it.

- **Reads:** Meets / Met by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`adapter`](#kind-adapter) | [`standard_rule`](#kind-standard_rule) | The adapter follows the standard rule. |
| [`command_handler`](#kind-command_handler) | [`standard_rule`](#kind-standard_rule) | The command handler follows the standard rule. |
| [`data_model`](#kind-data_model) | [`standard_rule`](#kind-standard_rule) | The data model follows the standard rule. |
| [`endpoint_handler`](#kind-endpoint_handler) | [`standard_rule`](#kind-standard_rule) | The endpoint handler follows the standard rule. |
| [`entry_point`](#kind-entry_point) | [`standard_rule`](#kind-standard_rule) | The entry point follows the standard rule. |
| [`event_handler`](#kind-event_handler) | [`standard_rule`](#kind-standard_rule) | The event handler follows the standard rule. |
| [`event_type`](#kind-event_type) | [`standard_rule`](#kind-standard_rule) | The event type follows the standard rule. |
| [`predicate`](#kind-predicate) | [`standard_rule`](#kind-standard_rule) | The predicate follows the standard rule. |
| [`projection`](#kind-projection) | [`standard_rule`](#kind-standard_rule) | The projection follows the standard rule. |
| [`query_handler`](#kind-query_handler) | [`standard_rule`](#kind-standard_rule) | The query handler follows the standard rule. |
| [`reader`](#kind-reader) | [`standard_rule`](#kind-standard_rule) | The reader follows the standard rule. |
| [`repository`](#kind-repository) | [`standard_rule`](#kind-standard_rule) | The repository follows the standard rule. |
| [`rule`](#kind-rule) | [`standard_rule`](#kind-standard_rule) | The rule follows the standard rule. |
| [`service`](#kind-service) | [`standard_rule`](#kind-standard_rule) | The service follows the standard rule. |
| [`table`](#kind-table) | [`standard_rule`](#kind-standard_rule) | The table follows the standard rule. |
| [`tooling`](#kind-tooling) | [`standard_rule`](#kind-standard_rule) | The tooling record follows the standard rule. |
| [`ui_component`](#kind-ui_component) | [`standard_rule`](#kind-standard_rule) | The UI component follows the standard rule. |
| [`value_type`](#kind-value_type) | [`standard_rule`](#kind-standard_rule) | The value type follows the standard rule. |

<a id="relation-offers"></a>

### `offers`

The interface offers the use case, of its own product: its actors can carry it out there, and the interface has its own version of the use case's flow, derived by its pattern.

- **Reads:** Offers / Offered through
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`interface`](#kind-interface) | [`use_case`](#kind-use_case) | The use case is carried out through the interface. |

<a id="relation-persists"></a>

### `persists`

The repository loads and saves the aggregate, whole: one repository per aggregate, and one aggregate per repository.

- **Reads:** Persists / Persisted by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`repository`](#kind-repository) | [`aggregate`](#kind-aggregate) | The repository loads and saves the aggregate, whole. |

<a id="relation-presents"></a>

### `presents`

The view presents the command or query: a person sends the command or asks the query there, so a step that invokes it is carried out in the view on a web app or desktop interface.

- **Reads:** Presents / Presented in
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`view`](#kind-view) | [`command`](#kind-command) | A person sends the command in the view. |
| [`view`](#kind-view) | [`query`](#kind-query) | A person asks the query in the view. |

<a id="relation-provided_by"></a>

### `provided_by`

The record is provided by something outside the product, which decides it once for everyone who uses it: a dependency, a platform or a generic subdomain, reached through an integration or named by a record of a product's own kind (a component of a design system), once the product adds that pair with a product_relation named provided_by. A data store someone else runs, such as a managed database or a bucket, is provided by the integration that reaches it; a store the product owns outright, such as a local file, has none. A provided record counts as accounted for, and a provided obligation as built and proved, through its provider. One provider per record.

- **Reads:** Provided by / Provides
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`adapter`](#kind-adapter) | [`integration`](#kind-integration) | The adapter is provided by what the integration reaches, outside the product. |
| [`api_requirement`](#kind-api_requirement) | [`integration`](#kind-integration) | The API requirement is provided by what the integration reaches, outside the product. |
| [`command_handler`](#kind-command_handler) | [`integration`](#kind-integration) | The command handler is provided by what the integration reaches, outside the product. |
| [`constraint`](#kind-constraint) | [`integration`](#kind-integration) | The constraint is provided by what the integration reaches, outside the product. |
| [`data_model`](#kind-data_model) | [`integration`](#kind-integration) | The data model is provided by what the integration reaches, outside the product. |
| [`data_store`](#kind-data_store) | [`integration`](#kind-integration) | The data store is provided by what the integration reaches, outside the product. |
| [`domain_service`](#kind-domain_service) | [`integration`](#kind-integration) | The domain service is provided by what the integration reaches, outside the product. |
| [`endpoint`](#kind-endpoint) | [`integration`](#kind-integration) | The endpoint is provided by what the integration reaches, outside the product. |
| [`endpoint_handler`](#kind-endpoint_handler) | [`integration`](#kind-integration) | The endpoint handler is provided by what the integration reaches, outside the product. |
| [`entry_point`](#kind-entry_point) | [`integration`](#kind-integration) | The entry point is provided by what the integration reaches, outside the product. |
| [`event_handler`](#kind-event_handler) | [`integration`](#kind-integration) | The event handler is provided by what the integration reaches, outside the product. |
| [`event_type`](#kind-event_type) | [`integration`](#kind-integration) | The event type is provided by what the integration reaches, outside the product. |
| [`invariant`](#kind-invariant) | [`integration`](#kind-integration) | The invariant is provided by what the integration reaches, outside the product. |
| [`pattern_rule`](#kind-pattern_rule) | [`integration`](#kind-integration) | The pattern rule is provided by what the integration reaches, outside the product. |
| [`policy`](#kind-policy) | [`integration`](#kind-integration) | The policy is provided by what the integration reaches, outside the product. |
| [`predicate`](#kind-predicate) | [`integration`](#kind-integration) | The predicate is provided by what the integration reaches, outside the product. |
| [`projection`](#kind-projection) | [`integration`](#kind-integration) | The projection is provided by what the integration reaches, outside the product. |
| [`query_handler`](#kind-query_handler) | [`integration`](#kind-integration) | The query handler is provided by what the integration reaches, outside the product. |
| [`reader`](#kind-reader) | [`integration`](#kind-integration) | The reader is provided by what the integration reaches, outside the product. |
| [`repository`](#kind-repository) | [`integration`](#kind-integration) | The repository is provided by what the integration reaches, outside the product. |
| [`rule`](#kind-rule) | [`integration`](#kind-integration) | The rule is provided by what the integration reaches, outside the product. |
| [`service`](#kind-service) | [`integration`](#kind-integration) | The service is provided by what the integration reaches, outside the product. |
| [`specification`](#kind-specification) | [`integration`](#kind-integration) | The specification is provided by what the integration reaches, outside the product. |
| [`standard`](#kind-standard) | [`integration`](#kind-integration) | The standard is provided by what the integration reaches, outside the product. |
| [`standard_rule`](#kind-standard_rule) | [`integration`](#kind-integration) | The standard rule is provided by what the integration reaches, outside the product. |
| [`storage_requirement`](#kind-storage_requirement) | [`integration`](#kind-integration) | The storage requirement is provided by what the integration reaches, outside the product. |
| [`table`](#kind-table) | [`integration`](#kind-integration) | The table is provided by what the integration reaches, outside the product. |
| [`tooling`](#kind-tooling) | [`integration`](#kind-integration) | The tooling is provided by what the integration reaches, outside the product. |
| [`uc_requirement`](#kind-uc_requirement) | [`integration`](#kind-integration) | The UC requirement is provided by what the integration reaches, outside the product. |
| [`ui_component`](#kind-ui_component) | [`integration`](#kind-integration) | The UI component is provided by what the integration reaches, outside the product. |
| [`value_type`](#kind-value_type) | [`integration`](#kind-integration) | The value type is provided by what the integration reaches, outside the product. |
| [`view_requirement`](#kind-view_requirement) | [`integration`](#kind-integration) | The view requirement is provided by what the integration reaches, outside the product. |

<a id="relation-raises"></a>

### `raises`

The command raises the event, of the aggregate it changes.

- **Reads:** Raises / Raised by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`command`](#kind-command) | [`domain_event`](#kind-domain_event) | The command raises the event, of the aggregate it changes. |

<a id="relation-reads"></a>

### `reads`

The specification or read model reads the aggregate, of its own domain.

- **Reads:** Reads / Read by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`read_model`](#kind-read_model) | [`aggregate`](#kind-aggregate) | The read model shows the aggregate's data. |
| [`specification`](#kind-specification) | [`aggregate`](#kind-aggregate) | The specification is a predicate over the aggregate. |

<a id="relation-renders"></a>

### `renders`

The UI component renders the view, or part of it.

- **Reads:** Renders / Rendered by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`ui_component`](#kind-ui_component) | [`view`](#kind-view) | The UI component renders the view, or part of it. |

<a id="relation-selects_by"></a>

### `selects_by`

The query selects the records that satisfy the specification, of its own domain.

- **Reads:** Selects by / Selects for
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`query`](#kind-query) | [`specification`](#kind-specification) | The query selects the records that satisfy the specification. |

<a id="relation-serves"></a>

### `serves`

The capability serves the business outcome: what it is for. A capability may serve several outcomes, and an outcome be served by several capabilities.

- **Reads:** Serves / Served by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`capability`](#kind-capability) | [`business_outcome`](#kind-business_outcome) | The capability serves the business outcome. |

<a id="relation-starts_from"></a>

### `starts_from`

The test starts from the test data set: it is prepared before the test and reset after.

- **Reads:** Starts from / Starting point of
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`constraint_test`](#kind-constraint_test) | [`test_data_set`](#kind-test_data_set) | The constraint test starts from the test data set. |
| [`domain_service_test`](#kind-domain_service_test) | [`test_data_set`](#kind-test_data_set) | The domain service test starts from the test data set. |
| [`endpoint_test`](#kind-endpoint_test) | [`test_data_set`](#kind-test_data_set) | The endpoint test starts from the test data set. |
| [`flow_test`](#kind-flow_test) | [`test_data_set`](#kind-test_data_set) | The flow test starts from the test data set. |
| [`integration_test`](#kind-integration_test) | [`test_data_set`](#kind-test_data_set) | The integration test starts from the test data set. |
| [`invariant_test`](#kind-invariant_test) | [`test_data_set`](#kind-test_data_set) | The invariant test starts from the test data set. |
| [`pattern_rule_test`](#kind-pattern_rule_test) | [`test_data_set`](#kind-test_data_set) | The pattern rule test starts from the test data set. |
| [`policy_test`](#kind-policy_test) | [`test_data_set`](#kind-test_data_set) | The policy test starts from the test data set. |
| [`specification_test`](#kind-specification_test) | [`test_data_set`](#kind-test_data_set) | The specification test starts from the test data set. |
| [`standard_rule_test`](#kind-standard_rule_test) | [`test_data_set`](#kind-test_data_set) | The standard rule test starts from the test data set. |
| [`storage_requirement_test`](#kind-storage_requirement_test) | [`test_data_set`](#kind-test_data_set) | The storage requirement test starts from the test data set. |
| [`use_case_test`](#kind-use_case_test) | [`test_data_set`](#kind-test_data_set) | The use case test starts from the test data set. |
| [`view_test`](#kind-view_test) | [`test_data_set`](#kind-test_data_set) | The view test starts from the test data set. |

<a id="relation-stored_in"></a>

### `stored_in`

The repository, reader or table is kept in the data store: each names exactly one, where its data actually lives.

- **Reads:** Stored in / Stores
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`reader`](#kind-reader) | [`data_store`](#kind-data_store) | The reader reads its read model's table in the data store. |
| [`repository`](#kind-repository) | [`data_store`](#kind-data_store) | The repository loads and saves its aggregate in the data store. |
| [`table`](#kind-table) | [`data_store`](#kind-data_store) | The table is kept in the data store. |

## Checks of any kind

The checks that concern records of any kind: Lathe's, in the order they run, then the engine's own, then the product's.

<a id="check-not-designed"></a>

### `not-designed`

**Warning** · Lathe's

An obligation whose implementation is not specified yet, as coverage counts it.

Coverage counts an obligation as designed once its implementation is specified: a UC requirement once a step of its use case's flow fulfills it, a standard rule once a technical record meets it, a product's own obligation once a record links to it with a design relation. A constraint, invariant, specification, policy, domain service, view requirement and API requirement are designed by construction, and a pattern rule wherever it is owed. This warning names exactly the obligations coverage lists as not designed, so the two never disagree. Fulfill the UC requirement from a step of its flow, or link what designs the obligation.

<a id="check-not-built"></a>

### `not-built`

**Warning** · Lathe's

An obligation not every file of what implements it exists for yet, as coverage counts it.

Coverage counts an obligation as built once every one of the specific technical records that implement it names a file that exists, and there is at least one: a constraint's value type, an invariant's rule, a specification's predicate, a policy's event handler, a domain service's service, a UC requirement's command or query handlers (of what its fulfilling steps invoke) with the predicates and services of what they check, select by or call, and the adapter of each integration its steps exchange with, a view requirement's UI components that build it, an API requirement's endpoint handler, a standard rule's meeting records. Nothing else counts: no data model, unique key or UI component that only renders the view. A pattern rule asks for proof only. This warning names exactly the obligations coverage lists as not built. Add the technical record with its file, or write each file it names.

<a id="check-not-proved"></a>

### `not-proved`

**Warning** · Lathe's

An obligation no automated or manual test at an allowed level proves yet, as coverage counts it.

Coverage counts an obligation as proved once a test of it is automated or manual, at a level its test kind allows, and, when automated, its file exists and names the test's ID. A pattern rule is reported once for each domain that owes it, proved there only by its pattern rule test naming that domain. A test not automated yet does not prove, and the message says so. This warning names exactly the obligations coverage lists as not proved. Write the test, automate it or run it by hand, at a level its kind allows.

<a id="check-too-many-children"></a>

### `too-many-children`

**Warning** · Lathe's

A record with more children of one kind than its product's max_children setting.

The setting is the product's product_setting row (15 when it has none). A parent with that many children of one kind is missing a level between them, such as a capability or another aggregate. It counts a parent's children of each kind of the five design stages, discovery to the technical specification, since those are read as lists under their parent; a test is read under what it proves. Children are also counted per group, read from the record_group view, since each group reads under its own heading: a flow's steps per path, since each path reads as its own list, and the records of every kind with a `group_name` (terms, UC requirements, view requirements, API requirements, pattern rules, standard rules and a product's own kinds) per `group_name`; the ungrouped ones are one list. Paths and groups are compared trimmed and in any letter case. Add a level, or a group, and move the children into it.

<a id="check-flow-not-offered"></a>

### `flow-not-offered`

**Warning** · Lathe's

A use case with a flow that no interface offers.

A flow says how its use case is carried out whatever the interface, and each interface that offers the use case has its own version of it. A use case no interface offers has a flow nobody can follow. Offer it through the interfaces it happens through.

<a id="check-accidental-not-accounted-for"></a>

### `accidental-not-accounted-for`

**Warning** · Lathe's

An accidental record that is neither derived (a tooling record generates it), provided (it or a record it sits under names its provider), nor a fill of a pattern's slot that serves an essential record.

Essential complexity is decided once, per product; accidental complexity, what comes from the means used to build it, is derived, provided, or a recorded fill at a slot, never free-floating (LA-STD-PRINCIPLES). A record is accidental by its kind (the technical specification), or as an engineering standard and its rules; a test follows what it proves and is not reported. It is accounted for when a tooling record generates it (generates), when it or a record it sits under is provided by something outside the product (provided_by), or when it fills a pattern's slot (fills) and serves an essential record: it builds an essential obligation as coverage counts it, or it implements an essential record it sits under, directly or through other accidental records such as an endpoint (other than its product or domain). Generate it, name its provider, or record the slot it fills under the essential record it serves; code that serves nothing essential is removed.

<a id="check-accidental-in-essential"></a>

### `accidental-in-essential`

**Warning** · Lathe's

An essential record whose title or lead text names technology its kind of record has no business with: a mechanism of an interface or of storage, a technical kind, one of the product's interfaces, or a word the product lists as technology.

Essential complexity is what any correct solution has to capture, however it is built, so an essential record says what the product's people need in their own words and leaves how it is built to the patterns and the technical specification (LA-STD-PRINCIPLES). The check reads each essential record's title and lead text (its statement, goal, meaning or description), in any letter case, as whole words, singular or plural, code in backticks included, for the words of its kind's group. The domain model, use cases, flows and every other essential kind are read for the interface words page, screen, button, click, endpoint, route, URL, HTTP and query string; the storage words table, row, column, JSON, SQL and database; the titles of the product's own interfaces (such as CLI or Web app); and the technical kinds. A step only one interface can do (a variant) names that interface, so the interface's own title is the step's. A view and its requirements are on their interface by nature, so pages, screens, buttons, clicks, rows, columns, tables, routes and URLs are theirs: they are read for endpoint, HTTP, query string, JSON, SQL, database and the technical kinds. An interface, an integration and an API requirement are a contract with the outside world, which names its mechanism: they are read for the technical kinds only. Patterns, their rules and slots are where the product decides its accidental complexity once, and a test says how it proves through the interface it drives, so neither is read. The technical kinds are data store, repository, data model, value type, event type, projection, command handler, query handler, event handler, endpoint handler, adapter, entry point and UI component. A word that is the title of a term of the record's own domain (of any of its product's domains, for a record that sits in none, such as a view) is that domain's language, not technology, so it is not reported there: a product about specs has a term Table. The words the product's settings list as technology (technology_words) are read in every group and never excused. A mixed kind, one whose records hold both, is split rather than excused. A write that adds such a record, or changes its title or lead text, is refused for the same words (essential-names-technology), so this check reports what was in the data before. Say what is needed without the mechanism, move the mechanism to the pattern or technical record that decides it, or split the record.

<a id="check-essential-repeated"></a>

### `essential-repeated`

**Warning** · Lathe's

The same requirement or step statement in three or more use cases or views: a pattern in disguise, decided again in each.

Essential complexity is decided once, per product (LA-STD-PRINCIPLES-R05): what several use cases or views share is one decision, written once as a rule of a pattern they follow. The check reads each essential UC requirement's and view requirement's statement and each flow step's title, in lower case, with every title of the product's aggregates and entities (singular or plural) read as one placeholder, an and a read alike, and anything but letters, digits and the placeholder read as one space. A statement that reads the same in three or more use cases or views is reported once, on the first of its records by ID, naming them all. Write the statement once as a rule of a pattern, with a setting for what differs, have the use cases follow it, and drop the repeats.

<a id="check-variant-not-offered"></a>

### `variant-not-offered`

**Error** · Lathe's

A variant step whose interface does not offer its use case.

A step only one interface can do names that interface, and that interface's version of the flow is the only one that has it. An interface that does not offer the use case has no version, so the step would be in none. Offer the use case through the interface, name another interface that does, or make the step every interface's.

<a id="check-essential-restates-technical"></a>

### `essential-restates-technical`

**Warning** · Lathe's

An essential record that names the shape of a technical record of its product: a table name, a file or folder, an endpoint's route, or a command line.

What follows from the spec is not essential (LA-STD-PRINCIPLES-R05, R06): a record that says an entity's fields are the rows of a table, or that a check is added with a command line, restates the technical specification in the words of the essential one. The check reads each essential record's title and lead text, but for the kinds that are a contract with the outside world (an interface, an integration, an API requirement), which name their mechanism, and reports what it names exactly: the name of one of the product's tables that holds an underscore, written as storage (followed by row, table or column, singular or plural), unless it is the title of one of the product's terms; a file of one of the product's accidental records, or a folder one of them is in (written with its closing slash); an HTTP method followed by a path, or the route of one of the product's endpoints, in any record but a view and its requirements; and a command line in backticks: a program followed by arguments, one of them a flag (--name or -n) or a placeholder (<name> or %A). It reports only what matches a technical record or that shape, so a word that only sounds technical is never reported. Say what the product's people need in their own words, and leave the shape to the technical record, or remove the record when that is all it says.

<a id="check-interface-actor-not-the-use-case"></a>

### `interface-actor-not-the-use-case`

**Warning** · Lathe's

An interface that offers a use case none of whose actors uses the interface.

A step's actor through an interface is the first of its use case's actors that the interface lists among its roles (interface_actor). When the interface lists roles and none of them is one of the use case's actors, nobody can carry the use case out there. List the role among the interface's, add it to the use case's actors, or stop offering the use case through the interface.

<a id="check-data-refused"></a>

### `data-refused`

**Error** · the engine

Every data file loads: the store accepts every row of data/ with every key and rule of the schema.

A row that breaks the schema (a missing parent, a link to a record that does not exist, a value outside its enum, an ID used twice) is refused when the data loads, and nothing is checked until it is fixed. Each refusal names the file, the line and the rule it broke. Fix the row through the CLI or the app, or resolve the merge that brought it.
