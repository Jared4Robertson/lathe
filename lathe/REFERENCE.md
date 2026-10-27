# Lathe reference

Lathe keeps a product's spec as typed rows: a table per kind of record, with typed columns and real keys, so data
that breaks the model cannot be saved. Each stored table is one file, `data/<table>.jsonl`, with one JSON object
per line, sorted by key. Containment is a foreign key (a requirement's `use_case_id`), a link is a row of its
relation's table, and an ID is unique across every kind. Every write goes through the command layer (the CLI, the
app and the plugin's tools), which validates it in one transaction and rewrites the lines it changed; git is the
history.

The checks below are rows of the `check` table. Each holds the query that finds its problems: a SELECT over the
tables returning `severity`, `record` and `message` for each problem. Lathe's own are in `lathe/data/check.jsonl`,
loaded beside every product's data; a product adds its own as rows of its `data/check.jsonl` with its
`product_id`. What the schema enforces is never a check: the store refuses it.

<!-- Generated from the schema and the check rows by `npm --prefix lathe run reference`. Do not edit it by hand. -->

## Kinds

Every kind of record, with its table. A record of the kind is one row of the table named after it.

<a id="kind-product"></a>

### Product (`product`)

A product: the root of a set of specifications.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** none (a root record)
- **Children:** [`domain`](#kind-domain), [`pattern`](#kind-pattern), [`standard`](#kind-standard), [`question`](#kind-question)
- **Obligation:** no
- **ID:** `<P>`, such as `TL`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`role`](#table-role)

<a id="table-product"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The product's ID, its prefix, such as TL. |
| `title` | VARCHAR | yes | The product's name, such as Tool Library. |
| `description` | VARCHAR | no | What the product is, who it is for and what it must do, in a paragraph. |
| `icon` | VARCHAR | no | An emoji or short text shown for the product in the app's space rail. |
| `color` | VARCHAR | no | A CSS color for the product in the app's space rail. |
| `notes` | VARCHAR | no | Longer notes on the product, such as how it is delivered. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-domain"></a>

### Domain (`domain`)

A part of the product with its own model, language and owner: one business capability, never a technology layer.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`capability`](#kind-capability), [`aggregate`](#kind-aggregate), [`domain_rule`](#kind-domain_rule), [`use_case`](#kind-use_case), [`flow`](#kind-flow), [`view`](#kind-view), [`api`](#kind-api), [`endpoint`](#kind-endpoint), [`integration`](#kind-integration), [`interaction_requirement`](#kind-interaction_requirement), [`layer`](#kind-layer), [`component`](#kind-component), [`design_flow`](#kind-design_flow), [`test`](#kind-test), [`question`](#kind-question)
- **Obligation:** no
- **ID:** `<P>-<D>`, such as `TL-LEND`
- **Links out:** Follows ([`follows`](#relation-follows))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`domain-named-for-technology`](#check-domain-named-for-technology)

<a id="table-domain"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The domain's ID: the product prefix and the domain code, such as TL-LEND. |
| `title` | VARCHAR | yes | The domain's name, such as Lending. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `description` | VARCHAR | no | What the domain covers, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes, such as its language or the example values it decides. |

- **Key:** `id`
- **Unique:** `id`, `product_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-capability"></a>

### Capability (`capability`)

An ordered slice of a domain that groups its use cases, flows and tests, such as Membership or Lending.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`use_case`](#kind-use_case), [`flow`](#kind-flow), [`test`](#kind-test)
- **Obligation:** no
- **ID:** `<P>-<D>-CAP<nn>`, such as `TL-LEND-CAP01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`use-case-outside-capability`](#check-use-case-outside-capability), [`lone-child`](#check-lone-child)

<a id="table-capability"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The capability's ID, such as TL-LEND-CAP01. |
| `title` | VARCHAR | yes | The capability's name, such as Membership. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `position` | INTEGER | yes | Its place in the domain, from 1. |
| `description` | VARCHAR | no | What the capability covers, in a sentence or two. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Unique:** `domain_id`, `position`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("position" >= 1)`

<a id="kind-aggregate"></a>

### Aggregate (`aggregate`)

A cluster of records changed together as one unit, with its own identity and rules.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`entity`](#kind-entity), [`domain_event`](#kind-domain_event), [`domain_rule`](#kind-domain_rule), [`question`](#kind-question)
- **Obligation:** no
- **ID:** `<P>-<D>-A<n>`, such as `TL-LEND-A1`
- **Links out:** Reacts to ([`reacts_to`](#relation-reacts_to)), Relates to ([`relates_to`](#relation-relates_to))
- **Links in:** Questions about this ([`about`](#relation-about)), Involved in ([`involves`](#relation-involves)), Related to by ([`relates_to`](#relation-relates_to))
- **Checks:** [`event-unheard`](#check-event-unheard), [`domain-rule-involves`](#check-domain-rule-involves)

<a id="table-aggregate"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The aggregate's ID, such as TL-LEND-A1. |
| `title` | VARCHAR | yes | The aggregate's name, such as Loan. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `description` | VARCHAR | no | What the aggregate keeps, in a paragraph. |
| `identity` | VARCHAR | no | What identifies one of its records in the business, such as Loan ID. |
| `notes` | VARCHAR | no | Longer notes on the aggregate. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-entity"></a>

### Entity (`entity`)

A record the domain keeps, as one box of an aggregate's ERD: the aggregate's root or one of its children. Its fields are entity_field rows.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`)
- **Children:** [`domain_rule`](#kind-domain_rule)
- **Obligation:** no
- **ID:** `<P>-<D>-EN<nn>`, such as `TL-LEND-EN01`
- **Links out:** Has many ([`has_many`](#relation-has_many)), Has one ([`has_one`](#relation-has_one)), Refers to ([`refers_to`](#relation-refers_to))
- **Links in:** Questions about this ([`about`](#relation-about)), Part of ([`has_many`](#relation-has_many)), Part of ([`has_one`](#relation-has_one)), Raises ([`raised_by`](#relation-raised_by)), Referred to by ([`refers_to`](#relation-refers_to))
- **Parts:** [`entity_field`](#table-entity_field)
- **Checks:** [`entity-fields`](#check-entity-fields), [`has-crosses-aggregate`](#check-has-crosses-aggregate), [`entity-unreferenced`](#check-entity-unreferenced), [`raised-by-outside-aggregate`](#check-raised-by-outside-aggregate)

<a id="table-entity"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The entity's ID, such as TL-LEND-EN01. |
| `title` | VARCHAR | yes | The entity's name, such as Return. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | yes | The aggregate it belongs to. |
| `role` | ENUM('root', 'child') | yes | root: the record the aggregate is named for; child: one of its parts. |
| `description` | VARCHAR | no | What the entity is, in a sentence or two. |

- **Key:** `id`
- **Unique:** `id`, `aggregate_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-domain_event"></a>

### Domain event (`domain_event`)

An unchangeable record that something happened in the domain, raised by its aggregate and named in the past tense (Loan opened). What it carries are event_field rows.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<P>-<D>-EV<nn>`, such as `TL-LEND-EV01`
- **Links out:** Raised by ([`raised_by`](#relation-raised_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Reacted to by ([`reacts_to`](#relation-reacts_to))
- **Parts:** [`event_field`](#table-event_field)
- **Checks:** [`entity-fields`](#check-entity-fields), [`event-unheard`](#check-event-unheard), [`event-tense`](#check-event-tense), [`raised-by-outside-aggregate`](#check-raised-by-outside-aggregate)

<a id="table-domain_event"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The event's ID, such as TL-LEND-EV01. |
| `title` | VARCHAR | yes | The event's name, in the past tense, such as Tool repaired. |
| `aggregate_id` | VARCHAR → [`aggregate`](#table-aggregate) | yes | The aggregate that raises it. |
| `description` | VARCHAR | no | What happened, in a sentence. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-domain_rule"></a>

### Domain rule (`domain_rule`)

A fact that must always hold for an aggregate's records, whatever use case changes them. It names its domain, and its aggregate unless it holds across aggregates, when it names them with involves.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`entity`](#kind-entity) (`entity_id`), [`aggregate`](#kind-aggregate) (`aggregate_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<P>-<D>-DR<nn>`, such as `TL-LEND-DR01`
- **Links out:** Involves ([`involves`](#relation-involves))
- **Links in:** Questions about this ([`about`](#relation-about)), Applied by ([`applies`](#relation-applies)), Carried out in ([`fulfills`](#relation-fulfills)), Proved by ([`proves`](#relation-proves)), Designed by ([`satisfies`](#relation-satisfies)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`rule-not-applied`](#check-rule-not-applied), [`domain-rule-involves`](#check-domain-rule-involves)

<a id="table-domain_rule"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The rule's ID, such as TL-LEND-DR01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `aggregate_id` | VARCHAR | no | The aggregate it holds for, of the same domain; none for a rule across aggregates. |
| `entity_id` | VARCHAR | no | The entity of that aggregate it is about, if one. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |

- **Key:** `id`
- **Foreign key:** `(aggregate_id, domain_id) -> aggregate (id, domain_id)`
- **Foreign key:** `(entity_id, aggregate_id) -> entity (id, aggregate_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`
- **Rule:** `((entity_id IS NULL) OR (aggregate_id IS NOT NULL))`

<a id="kind-use_case"></a>

### Use case (`use_case`)

Something an actor does with the product to reach a goal. Its actors are use_case_actor rows and its steps use_case_step rows.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`capability`](#kind-capability) (`capability_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`requirement`](#kind-requirement), [`question`](#kind-question)
- **Obligation:** no
- **ID:** `<P>-<D>-UC<nn>`, such as `TL-LEND-UC01`
- **Links out:** Applies ([`applies`](#relation-applies)), Follows ([`follows`](#relation-follows)), Reacts to ([`reacts_to`](#relation-reacts_to))
- **Links in:** Questions about this ([`about`](#relation-about)), Carried out by flow ([`carries_out`](#relation-carries_out))
- **Parts:** [`use_case_actor`](#table-use_case_actor), [`use_case_step`](#table-use_case_step)
- **Checks:** [`use-case-without-requirements`](#check-use-case-without-requirements), [`use-case-outside-capability`](#check-use-case-outside-capability), [`pattern-setting-missing`](#check-pattern-setting-missing), [`use-case-without-flow`](#check-use-case-without-flow), [`event-unheard`](#check-event-unheard)

<a id="table-use_case"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The use case's ID, such as TL-LEND-UC01. |
| `title` | VARCHAR | yes | What the actor does, such as Borrow a tool. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `capability_id` | VARCHAR | no | The capability of that domain it sits in, if one. |
| `goal` | VARCHAR | no | What the actor wants to reach, in a sentence. |
| `notes` | VARCHAR | no | Longer notes, such as the order in which refusals are reported. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Foreign key:** `(capability_id, domain_id) -> capability (id, domain_id)`
- **Rule:** `("trim"(title) != '')`

<a id="kind-requirement"></a>

### UC requirement (`requirement`)

One rule a use case must follow. Shown as a UC (use case) requirement, to tell it apart from interaction requirements and pattern rules.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`use_case`](#kind-use_case) (`use_case_id`)
- **Children:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<use case>-R<nn>`, such as `TL-LEND-UC01-R01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Carried out in ([`fulfills`](#relation-fulfills)), Proved by ([`proves`](#relation-proves)), Designed by ([`satisfies`](#relation-satisfies)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`lone-child`](#check-lone-child)

<a id="table-requirement"></a>

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

Behavior several use cases share, stated once with the settings each use case that follows it fills in. Its settings are pattern_setting rows and its rules pattern_rule records.

- **Stage:** Define
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`pattern_rule`](#kind-pattern_rule)
- **Obligation:** no
- **ID:** `<P>-PAT-<name>`, such as `TL-PAT-LIBRARIAN-ACTION`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Followed by ([`follows`](#relation-follows))
- **Parts:** [`pattern_setting`](#table-pattern_setting)
- **Checks:** [`pattern-setting-missing`](#check-pattern-setting-missing), [`pattern-not-followed`](#check-pattern-not-followed)

<a id="table-pattern"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The pattern's ID, such as TL-PAT-LIBRARIAN-ACTION. |
| `title` | VARCHAR | yes | The pattern's name, such as Librarian action. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `description` | VARCHAR | no | The shared behavior, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes, such as how a domain or use case uses the pattern. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-pattern_rule"></a>

### Pattern rule (`pattern_rule`)

One rule of a pattern. Every domain that follows the pattern proves it, unless it names a setting all of that domain's followers mark Not applicable, or its applies-when condition is met by no follower there.

- **Stage:** Define
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`pattern`](#kind-pattern) (`pattern_id`)
- **Children:** none
- **Obligation:** proof only
- **ID:** `<pattern>-R<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-R01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Carried out in ([`fulfills`](#relation-fulfills)), Proved by ([`proves`](#relation-proves)), Designed by ([`satisfies`](#relation-satisfies)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`lone-child`](#check-lone-child)

<a id="table-pattern_rule"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The rule's ID: its pattern's ID and R<nn>, such as TL-PAT-LIBRARIAN-ACTION-R01. |
| `title` | VARCHAR | yes | The rule in a few words. |
| `pattern_id` | VARCHAR → [`pattern`](#table-pattern) | yes | The pattern it belongs to. |
| `statement` | VARCHAR | yes | The rule, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings, such as Validation or Paging. |
| `setting` | VARCHAR | no | A setting of its pattern the rule depends on: in a domain whose following use cases all mark it Not applicable, the rule does not apply. |
| `applies_when_setting` | VARCHAR | no | The setting of its pattern its applies-when condition reads; the rule is waived in a domain where no follower gives that setting a value that meets it. |
| `applies_when_negated` | BOOLEAN | no | false: the condition is <setting> is <value>; true: <setting> is not <value>. |
| `applies_when_value` | VARCHAR | no | The value the condition compares with, trimmed and in any letter case. |
| `notes` | VARCHAR | no | Longer notes on how the rule applies. |

- **Key:** `id`
- **Foreign key:** `(pattern_id, setting) -> pattern_setting (pattern_id, name)`
- **Foreign key:** `(pattern_id, applies_when_setting) -> pattern_setting (pattern_id, name)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`
- **Rule:** `(((applies_when_setting IS NULL) = (applies_when_negated IS NULL)) AND ((applies_when_setting IS NULL) = (applies_when_value IS NULL)))`

<a id="kind-standard"></a>

### Standard (`standard`)

A library of engineering rules that holds for the product's code, such as logging, error handling or naming. What follows one of its rules meets it; a standard asks nothing of a domain.

- **Stage:** Design
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`product`](#kind-product) (`product_id`)
- **Children:** [`standard_rule`](#kind-standard_rule)
- **Obligation:** no
- **ID:** `<P>-STD-<name>`, such as `TL-STD-CODE`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`standard-rule-unmet`](#check-standard-rule-unmet)

<a id="table-standard"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The standard's ID, such as TL-STD-CODE. |
| `title` | VARCHAR | yes | The standard's name. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `description` | VARCHAR | no | What the standard covers, in a paragraph. |

- **Key:** `id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-standard_rule"></a>

### Standard rule (`standard_rule`)

One rule of a standard. It is not an obligation: what follows it links to it with meets.

- **Stage:** Design
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`standard`](#kind-standard) (`standard_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<standard>-R<nn>`, such as `TL-STD-CODE-R01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Met by ([`meets`](#relation-meets))
- **Checks:** [`lone-child`](#check-lone-child), [`standard-rule-unmet`](#check-standard-rule-unmet)

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

<a id="kind-flow"></a>

### Flow (`flow`)

An end-to-end path through views and endpoints that carries out one or more use cases. Its steps are flow_step records.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`capability`](#kind-capability) (`capability_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`flow_step`](#kind-flow_step), [`interaction_requirement`](#kind-interaction_requirement)
- **Obligation:** no
- **ID:** `<P>-<D>-F<nn>`, such as `TL-LEND-F01`
- **Links out:** Carries out ([`carries_out`](#relation-carries_out)), Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses))
- **Links in:** Questions about this ([`about`](#relation-about)), Deepened by ([`deepens`](#relation-deepens)), Run by ([`runs`](#relation-runs))
- **Checks:** [`use-case-without-flow`](#check-use-case-without-flow), [`flow-step-fulfills-outside-flow`](#check-flow-step-fulfills-outside-flow), [`flow-fulfills-differs-from-steps`](#check-flow-fulfills-differs-from-steps)

<a id="table-flow"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The flow's ID, such as TL-LEND-F01. |
| `title` | VARCHAR | yes | The flow's name, such as Borrow and return a tool. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `capability_id` | VARCHAR | no | The capability of that domain it sits in, if one. |
| `description` | VARCHAR | no | The path, in a paragraph. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Foreign key:** `(capability_id, domain_id) -> capability (id, domain_id)`
- **Rule:** `("trim"(title) != '')`

<a id="kind-flow_step"></a>

### Flow step (`flow_step`)

One step of a flow, in order on its path: what happens, through which view, endpoint or component, and what the step carries out.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`flow`](#kind-flow) (`flow_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<flow>-S<nn>`, such as `TL-LEND-F01-S01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`step-order`](#check-step-order), [`flow-step-fulfills-outside-flow`](#check-flow-step-fulfills-outside-flow), [`flow-fulfills-differs-from-steps`](#check-flow-fulfills-differs-from-steps)

<a id="table-flow_step"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The step's ID: its flow's ID and S<nn>, such as TL-LEND-F01-S01. |
| `title` | VARCHAR | yes | What happens, in a few words. |
| `flow_id` | VARCHAR → [`flow`](#table-flow) | yes | The flow it belongs to. |
| `path` | VARCHAR | yes | The path through the flow the step is on, such as main or refused. |
| `position` | INTEGER | yes | The step's place on its path, from 1. |
| `description` | VARCHAR | no | What happens in the step, in a sentence or two. |

- **Key:** `id`
- **Unique:** `flow_id`, `path`, `position`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(path) != '')`
- **Rule:** `("position" >= 1)`

<a id="kind-view"></a>

### View (`view`)

A screen or page a person uses.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`interaction_requirement`](#kind-interaction_requirement)
- **Obligation:** no
- **ID:** `<P>-<D>-V<nn>`, such as `TL-LEND-V01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses))
- **Links in:** Questions about this ([`about`](#relation-about)), Implemented by ([`implements`](#relation-implements)), Used by ([`uses`](#relation-uses))

<a id="table-view"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The view's ID, such as TL-LEND-V01. |
| `title` | VARCHAR | yes | The view's name, such as Catalog. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `route` | VARCHAR | no | The address it is shown at, such as /<domain-id>. |
| `description` | VARCHAR | no | What the view shows and lets a person do, in a paragraph. |
| `notes` | VARCHAR | no | Longer notes on the view. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-api"></a>

### API (`api`)

A group of endpoints for one resource, such as Loans: it holds the resource's endpoints and the interaction requirements that hold for every endpoint in it. The shapes its endpoints share are api_shape rows.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`endpoint`](#kind-endpoint), [`interaction_requirement`](#kind-interaction_requirement)
- **Obligation:** no
- **ID:** `<P>-<D>-API<nn>`, such as `TL-LEND-API01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Parts:** [`api_shape`](#table-api_shape)

<a id="table-api"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The API's ID, such as TL-LEND-API01. |
| `title` | VARCHAR | yes | The resource's name, such as Loans. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `description` | VARCHAR | no | The resource and where it is served, in a sentence or two. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-endpoint"></a>

### Endpoint (`endpoint`)

An HTTP endpoint: its method, route, request and responses. It sits in the API for its resource, or in the domain.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`api`](#kind-api) (`api_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`interaction_requirement`](#kind-interaction_requirement)
- **Obligation:** no
- **ID:** `<P>-<D>-E<nn>`, such as `TL-LEND-E01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills))
- **Links in:** Questions about this ([`about`](#relation-about)), Implemented by ([`implements`](#relation-implements)), Used by ([`uses`](#relation-uses))

<a id="table-endpoint"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The endpoint's ID, such as TL-LEND-E01. |
| `title` | VARCHAR | yes | What the endpoint does, such as Borrow a tool. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `api_id` | VARCHAR | no | The API of that domain it sits in, if one. |
| `method` | ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS') | yes | The HTTP method. |
| `route` | VARCHAR | yes | The route, such as /loans or /tools/{toolId}/damage. |
| `description` | VARCHAR | no | Its request and responses, in a sentence or two. |
| `notes` | VARCHAR | no | Longer notes on the endpoint. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Foreign key:** `(api_id, domain_id) -> api (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(route) != '')`

<a id="kind-integration"></a>

### Integration (`integration`)

An outside system the domain exchanges with, such as a payment provider or a mail service. It holds one interaction requirement per exchange.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`interaction_requirement`](#kind-interaction_requirement)
- **Obligation:** no
- **ID:** `<P>-<D>-INT<nn>`, such as `TL-LEND-INT01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="table-integration"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The integration's ID, such as TL-LEND-INT01. |
| `title` | VARCHAR | yes | The integration's name. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `system` | VARCHAR | no | The outside system, such as Stripe. |
| `description` | VARCHAR | no | What the domain exchanges with it, in a sentence or two. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Rule:** `("trim"(title) != '')`

<a id="kind-interaction_requirement"></a>

### Interaction requirement (`interaction_requirement`)

One rule a view, endpoint, flow, API or integration must follow, such as a field's limits, an error's response or one exchange with an outside system. One under an API holds for every endpoint in it; one with none of them holds across the domain's interaction design.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`view`](#kind-view) (`view_id`), [`endpoint`](#kind-endpoint) (`endpoint_id`), [`flow`](#kind-flow) (`flow_id`), [`api`](#kind-api) (`api_id`), [`integration`](#kind-integration) (`integration_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<view, endpoint, flow, API or integration>-R<nn>, or <P>-<D>-IR<nn> under the domain`, such as `TL-LEND-E03-R01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills))
- **Links in:** Questions about this ([`about`](#relation-about)), Carried out in ([`fulfills`](#relation-fulfills)), Proved by ([`proves`](#relation-proves)), Designed by ([`satisfies`](#relation-satisfies)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`interaction-requirement-fulfills-nothing`](#check-interaction-requirement-fulfills-nothing), [`lone-child`](#check-lone-child)

<a id="table-interaction_requirement"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The requirement's ID: its parent's ID and R<nn>, such as TL-LEND-E03-R01, or <P>-<D>-IR<nn> under the domain. |
| `title` | VARCHAR | yes | The requirement in a few words. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `view_id` | VARCHAR | no | The view of that domain it holds for, if one. |
| `endpoint_id` | VARCHAR | no | The endpoint of that domain it holds for, if one. |
| `flow_id` | VARCHAR | no | The flow of that domain it holds for, if one. |
| `api_id` | VARCHAR | no | The API of that domain it holds for, for every endpoint in it, if one. |
| `integration_id` | VARCHAR | no | The integration of that domain whose exchange it states, if one. |
| `statement` | VARCHAR | yes | The requirement, stated with MUST, MUST NOT, SHOULD or MAY. |
| `group_name` | VARCHAR | no | A short heading it is shown under among its siblings, such as Validation or Paging. |

- **Key:** `id`
- **Foreign key:** `(view_id, domain_id) -> view (id, domain_id)`
- **Foreign key:** `(endpoint_id, domain_id) -> endpoint (id, domain_id)`
- **Foreign key:** `(flow_id, domain_id) -> flow (id, domain_id)`
- **Foreign key:** `(api_id, domain_id) -> api (id, domain_id)`
- **Foreign key:** `(integration_id, domain_id) -> integration (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("statement") != '')`
- **Rule:** `(((((CAST((view_id IS NOT NULL) AS INTEGER) + CAST((endpoint_id IS NOT NULL) AS INTEGER)) + CAST((flow_id IS NOT NULL) AS INTEGER)) + CAST((api_id IS NOT NULL) AS INTEGER)) + CAST((integration_id IS NOT NULL) AS INTEGER)) <= 1)`

<a id="kind-layer"></a>

### Layer (`layer`)

An ordered part of a domain's technical specification that groups its components by what they are, such as Models, Services or Web app. It sits in the domain, or in another layer of it as a sub-layer.

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`layer`](#kind-layer) (`parent_layer_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`layer`](#kind-layer), [`component`](#kind-component), [`design_flow`](#kind-design_flow)
- **Obligation:** no
- **ID:** `<P>-<D>-LAY<nn>`, such as `TL-LEND-LAY01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`layer-order`](#check-layer-order), [`component-outside-layer`](#check-component-outside-layer), [`lone-child`](#check-lone-child)

<a id="table-layer"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The layer's ID, such as TL-LEND-LAY01. |
| `title` | VARCHAR | yes | The layer's name, such as Services. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `parent_layer_id` | VARCHAR | no | The layer of that domain it sits in as a sub-layer, if one. |
| `position` | INTEGER | yes | Its place among the layers beside it, from 1. |
| `description` | VARCHAR | no | What the layer holds, in a sentence or two. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Foreign key:** `(parent_layer_id, domain_id) -> layer (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("position" >= 1)`
- **Rule:** `((parent_layer_id IS NULL) OR (parent_layer_id != id))`

<a id="kind-component"></a>

### Component (`component`)

A unit of code in the target design, such as a model, service or router. It sits in a layer of its domain, or in the domain when the domain has no layers.

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`layer`](#kind-layer) (`layer_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`question`](#kind-question)
- **Obligation:** no
- **ID:** `<P>-<D>-C<nn>`, such as `TL-LEND-C01`
- **Links out:** Depends on ([`depends_on`](#relation-depends_on)), Implements ([`implements`](#relation-implements)), Meets ([`meets`](#relation-meets)), Reacts to ([`reacts_to`](#relation-reacts_to)), Satisfies ([`satisfies`](#relation-satisfies))
- **Links in:** Questions about this ([`about`](#relation-about)), Covered by ([`covers`](#relation-covers)), Depended on by ([`depends_on`](#relation-depends_on)), Used by ([`uses`](#relation-uses))
- **Checks:** [`component-file-missing`](#check-component-file-missing), [`component-outside-layer`](#check-component-outside-layer), [`event-unheard`](#check-event-unheard), [`component-satisfies-nothing`](#check-component-satisfies-nothing), [`standard-rule-unmet`](#check-standard-rule-unmet)

<a id="table-component"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The component's ID, such as TL-LEND-C01. |
| `title` | VARCHAR | yes | The component's name, often its file name. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `layer_id` | VARCHAR | no | The layer of that domain it sits in, if one. |
| `component_type` | VARCHAR | yes | What kind of code it is, in lower case, such as service or module. |
| `file` | VARCHAR | yes | The file that holds its code, from the product root; it may not exist yet. |
| `description` | VARCHAR | no | What the code does, in a paragraph. |

- **Key:** `id`
- **Unique:** `id`, `domain_id`
- **Foreign key:** `(layer_id, domain_id) -> layer (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `regexp_full_match(component_type, '[a-z][a-z0-9_-]*')`
- **Rule:** `("trim"(file) != '')`

<a id="kind-design_flow"></a>

### Technical flow (`design_flow`)

A technical flow: how the system carries out a flow. It deepens the flow, and its design_step records say, in order, which component does each part and what it designs.

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`layer`](#kind-layer) (`layer_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** [`design_step`](#kind-design_step)
- **Obligation:** no
- **ID:** `<P>-<D>-DF<nn>`, such as `TL-LEND-DF01`
- **Links out:** Deepens ([`deepens`](#relation-deepens))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`design-flow-deepens-nothing`](#check-design-flow-deepens-nothing)

<a id="table-design_flow"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The technical flow's ID, such as TL-LEND-DF01. |
| `title` | VARCHAR | yes | What the system carries out, such as Load and check a workspace. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `layer_id` | VARCHAR | no | The layer of that domain it sits in, if one. |
| `description` | VARCHAR | no | How the system carries it out, in a paragraph. |
| `notes` | VARCHAR | no | Its failures, limits and signals. |

- **Key:** `id`
- **Foreign key:** `(layer_id, domain_id) -> layer (id, domain_id)`
- **Rule:** `("trim"(title) != '')`

<a id="kind-design_step"></a>

### Technical step (`design_step`)

One step of a technical flow, in order on its path: what the system does, the component that does it (uses) and the obligations it designs (satisfies).

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`design_flow`](#kind-design_flow) (`design_flow_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<technical flow>-S<nn>`, such as `TL-LEND-DF01-S01`
- **Links out:** Meets ([`meets`](#relation-meets)), Satisfies ([`satisfies`](#relation-satisfies)), Uses ([`uses`](#relation-uses))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`step-order`](#check-step-order)

<a id="table-design_step"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The step's ID: its technical flow's ID and S<nn>, such as TL-LEND-DF01-S01. |
| `title` | VARCHAR | yes | What the system does, in a few words. |
| `design_flow_id` | VARCHAR → [`design_flow`](#table-design_flow) | yes | The technical flow it belongs to. |
| `path` | VARCHAR | yes | The path through the flow the step is on, such as main. |
| `position` | INTEGER | yes | The step's place on its path, from 1. |
| `description` | VARCHAR | no | What the system does in the step, in a sentence or two. |
| `transaction_name` | VARCHAR | no | The transaction the step runs in. |
| `locks` | VARCHAR | no | What the step locks. |
| `statements` | VARCHAR | no | How many statements the step runs, such as one SELECT per check file. |

- **Key:** `id`
- **Unique:** `design_flow_id`, `path`, `position`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"(path) != '')`
- **Rule:** `("position" >= 1)`

<a id="kind-test"></a>

### Test (`test`)

A test that proves obligations, or supports them without proving them. An automated test names the file that runs it; a manual test describes its procedure; a planned test is not proof.

- **Stage:** Design
- **Folder:** [Test plan](#folder-test-plan)
- **Parents:** [`capability`](#kind-capability) (`capability_id`), [`domain`](#kind-domain) (`domain_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<P>-<D>-T<nn>`, such as `TL-LEND-T01`
- **Links out:** Covers ([`covers`](#relation-covers)), Meets ([`meets`](#relation-meets)), Proves ([`proves`](#relation-proves)), Runs ([`runs`](#relation-runs)), Supports ([`supports`](#relation-supports))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`proof-not-in-file`](#check-proof-not-in-file), [`test-type-mismatch`](#check-test-type-mismatch), [`proof-still-owed`](#check-proof-still-owed), [`proof-counts-nowhere`](#check-proof-counts-nowhere), [`manual-test-file-silent`](#check-manual-test-file-silent), [`test-proves-nothing`](#check-test-proves-nothing), [`standard-rule-unmet`](#check-standard-rule-unmet)

<a id="table-test"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The test's ID, such as TL-LEND-T01. |
| `title` | VARCHAR | yes | What the test shows, in a sentence. |
| `domain_id` | VARCHAR → [`domain`](#table-domain) | yes | The domain it belongs to. |
| `capability_id` | VARCHAR | no | The capability of that domain it sits in, if one. |
| `test_type` | VARCHAR | yes | What kind of test it is, in lower case, such as unit, acceptance or domain_rule. |
| `state` | ENUM('automated', 'manual', 'planned') | yes | automated: a file runs it; manual: a person follows its procedure; planned: meant to prove its obligations, but not proof yet. |
| `file` | VARCHAR | no | The file that runs it, from the product root; an automated test must name one. |
| `key` | VARCHAR | no | Text its file contains in place of IDs. |
| `key_file` | VARCHAR | no | The file that holds the key (or the IDs), when the test runs from a shared class in another file; that file is read in place of file, which must still exist. |
| `given` | VARCHAR | no | The state the test starts from. |
| `when` | VARCHAR | no | What the test does. |
| `then` | VARCHAR | no | What the test expects. |
| `notes` | VARCHAR | no | Longer notes on the test, such as why it is manual, when to run it or how its code is keyed. |

- **Key:** `id`
- **Foreign key:** `(capability_id, domain_id) -> capability (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `regexp_full_match(test_type, '[a-z][a-z0-9_]*')`
- **Rule:** `((state != 'automated') OR (file IS NOT NULL))`
- **Rule:** `((key_file IS NULL) OR (file IS NOT NULL))`

<a id="kind-question"></a>

### Open question (`question`)

Something undecided, with the role that decides it. A decided question is removed and its answer written into the records it affects.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** [`aggregate`](#kind-aggregate) (`aggregate_id`), [`use_case`](#kind-use_case) (`use_case_id`), [`component`](#kind-component) (`component_id`), [`domain`](#kind-domain) (`domain_id`), [`product`](#kind-product) (`product_id`)
- **Children:** none
- **Obligation:** no
- **ID:** `<P>-<D>-Q<nn> or <P>-Q<nn>`, such as `TL-LEND-Q01`
- **Links out:** About ([`about`](#relation-about))
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="table-question"></a>

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | VARCHAR → `record_id` | yes | The question's ID, such as TL-LEND-Q01 or TL-Q01. |
| `title` | VARCHAR | yes | The question. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product it belongs to. |
| `domain_id` | VARCHAR | no | The domain of that product it sits in, if one. |
| `aggregate_id` | VARCHAR | no | The aggregate of that domain it sits under, if one. |
| `use_case_id` | VARCHAR | no | The use case of that domain it sits under, if one. |
| `component_id` | VARCHAR | no | The component of that domain it sits under, if one. |
| `owner` | VARCHAR | yes | The role that decides it, one of the product's roles, such as Owner. |
| `description` | VARCHAR | no | What is open, and the options. |

- **Key:** `id`
- **Foreign key:** `(domain_id, product_id) -> domain (id, product_id)`
- **Foreign key:** `(aggregate_id, domain_id) -> aggregate (id, domain_id)`
- **Foreign key:** `(use_case_id, domain_id) -> use_case (id, domain_id)`
- **Foreign key:** `(component_id, domain_id) -> component (id, domain_id)`
- **Rule:** `("trim"(title) != '')`
- **Rule:** `("trim"("owner") != '')`
- **Rule:** `(((CAST((aggregate_id IS NOT NULL) AS INTEGER) + CAST((use_case_id IS NOT NULL) AS INTEGER)) + CAST((component_id IS NOT NULL) AS INTEGER)) <= 1)`
- **Rule:** `((domain_id IS NOT NULL) OR ((aggregate_id IS NULL) AND (use_case_id IS NULL) AND (component_id IS NULL)))`

## Other tables

The tables that are not a kind of record and are kept in data files.

### Part tables: rows that belong to one record and are removed with it.

<a id="table-api_shape"></a>

#### `api_shape`

One request or response shape an API's endpoints share, in order.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `api_id` | VARCHAR → [`api`](#table-api) | yes | The API. |
| `position` | INTEGER | yes | The shape's place in the API, from 1. |
| `name` | VARCHAR | yes | The shape's name, such as Loan. |
| `meaning` | VARCHAR | yes | What the shape stands for. |
| `fields` | VARCHAR | yes | Its fields, such as id, memberId, toolId. |

- **Key:** `api_id`, `position`
- **Unique:** `api_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `("trim"(fields) != '')`

<a id="table-entity_field"></a>

#### `entity_field`

One field of an entity, in order.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `entity_id` | VARCHAR → [`entity`](#table-entity) | yes | The entity. |
| `position` | INTEGER | yes | The field's place in the entity, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Returned at: one name in its entity, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | VARCHAR | yes | The kind of value it holds, such as Date and time. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `entity_id`, `position`
- **Unique:** `entity_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `("trim"("type") != '')`

<a id="table-event_field"></a>

#### `event_field`

One field a domain event carries, in order.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `domain_event_id` | VARCHAR → [`domain_event`](#table-domain_event) | yes | The domain event. |
| `position` | INTEGER | yes | The field's place in the event, from 1. |
| `name` | VARCHAR | yes | The field's name, such as Repaired at: one name in its event, compared trimmed and in any letter case. |
| `meaning` | VARCHAR | yes | What the field means. |
| `type` | VARCHAR | yes | The kind of value it holds. |
| `example` | VARCHAR | no | An example value. |

- **Key:** `domain_event_id`, `position`
- **Unique:** `domain_event_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"("name") != '')`
- **Rule:** `("trim"(meaning) != '')`
- **Rule:** `("trim"("type") != '')`

<a id="table-pattern_setting"></a>

#### `pattern_setting`

One setting of a pattern, in order: what each follower decides.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `pattern_id` | VARCHAR → [`pattern`](#table-pattern) | yes | The pattern. |
| `position` | INTEGER | yes | The setting's place in the pattern, from 1. |
| `name` | VARCHAR | yes | The setting's name, in lower case with underscores, such as required_input. |
| `meaning` | VARCHAR | no | What a follower decides in it. |

- **Key:** `pattern_id`, `position`
- **Unique:** `pattern_id`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`

<a id="table-role"></a>

#### `role`

A role the product's records name, such as Owner, Reader or Agent: a use case's actors and a question's owner. Specs name roles, never people.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product. |
| `name` | VARCHAR | yes | The role's name, such as Librarian. |
| `description` | VARCHAR | no | Who takes the role and what they do. |

- **Key:** `product_id`, `name`
- **Rule:** `("trim"("name") != '')`

<a id="table-setting_value"></a>

#### `setting_value`

The value a use case or domain gives one setting of a pattern it follows: a value, or Not applicable with the reason.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `follower_id` | VARCHAR | yes | The use case or domain that follows the pattern. |
| `pattern_id` | VARCHAR | yes | The pattern it follows. |
| `setting` | VARCHAR | yes | The setting, one of the pattern's. |
| `value` | VARCHAR | no | The value it gives the setting. |
| `not_applicable` | VARCHAR | no | Why the setting does not apply to it, in place of a value. |

- **Key:** `follower_id`, `pattern_id`, `setting`
- **Foreign key:** `(follower_id, pattern_id) -> follows (source_id, target_id)`
- **Foreign key:** `(pattern_id, setting) -> pattern_setting (pattern_id, name)`
- **Rule:** `(("value" IS NULL) != (not_applicable IS NULL))`

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

<a id="table-use_case_step"></a>

#### `use_case_step`

One step of a use case's main course, in order.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `use_case_id` | VARCHAR → [`use_case`](#table-use_case) | yes | The use case. |
| `position` | INTEGER | yes | The step's place, from 1. |
| `description` | VARCHAR | yes | What happens in the step, in a sentence. |

- **Key:** `use_case_id`, `position`
- **Rule:** `("position" >= 1)`
- **Rule:** `("trim"(description) != '')`

### Declaration tables: a product's own kinds and relations.

<a id="table-product_kind"></a>

#### `product_kind`

A kind a product adds to Lathe's, such as an invariant or a report. Its records sit under one parent kind, and its fields are product_kind_field rows.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | VARCHAR | yes | The kind's name, in lower case with underscores, which is also its table's name; it must not be a table Lathe already has. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product that declares it; only that product's records may be of the kind. |
| `label` | VARCHAR | yes | The kind's name as people read it, such as Invariant. |
| `description` | VARCHAR | yes | What a record of the kind is. |
| `parent_kind` | VARCHAR | yes | The kind its records sit under: one of Lathe's or another product kind. Its table gets a <parent_kind>_id column. |
| `stage` | ENUM('define', 'design') | no | The stage its records belong to, if one. |
| `section` | VARCHAR → `meta_section` | no | The folder its records are read in, if one. |
| `obligation` | ENUM('none', 'full', 'proof') | yes | What a record of the kind asks: full, proof or none. An obligation kind joins the obligation supertype, so it can be designed, proved and carried out. |
| `id_pattern` | VARCHAR | no | How its IDs are written. |
| `id_example` | VARCHAR | no | An example ID. |

- **Key:** `name`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"("label") != '')`
- **Rule:** `("trim"(description) != '')`

<a id="table-product_kind_field"></a>

#### `product_kind_field`

One typed field of a product kind, in order: a column of its table.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `kind` | VARCHAR → [`product_kind`](#table-product_kind) | yes | The product kind. |
| `position` | INTEGER | yes | The field's place among the kind's columns, from 1. |
| `name` | VARCHAR | yes | The column's name, in lower case with underscores; not id, title or the parent column. |
| `type` | ENUM('text', 'integer', 'boolean', 'date') | yes | text, integer, boolean or date (YYYY-MM-DD). |
| `required` | BOOLEAN | yes | Whether every record of the kind must give it. |
| `description` | VARCHAR | yes | What the field holds. |

- **Key:** `kind`, `position`
- **Unique:** `kind`, `name`
- **Rule:** `("position" >= 1)`
- **Rule:** `regexp_full_match("name", '[a-z][a-z0-9_]*')`
- **Rule:** `("trim"(description) != '')`

<a id="table-product_relation"></a>

#### `product_relation`

A pair of kinds a product lets a relation link. A new relation name gets its own link table; a name Lathe already has adds the pair to that relation, when its link table's ends accept the two kinds.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | VARCHAR | yes | The relation's name, in lower case with underscores. |
| `source_kind` | VARCHAR | yes | The kind a link starts from. |
| `target_kind` | VARCHAR | yes | The kind a link points at, or * for any record. |
| `product_id` | VARCHAR → [`product`](#table-product) | yes | The product that declares it. |
| `role` | ENUM('design', 'proof') | no | design or proof, for a new relation that counts toward coverage. |
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
| `name` | VARCHAR | yes | The check's name, in lower case with hyphens, such as test-proves-nothing. |
| `product_id` | VARCHAR → [`product`](#table-product) | no | For a product's own check, the product; none for Lathe's checks. |
| `position` | INTEGER | yes | Its place in the run order, from 1: Lathe's checks run first, then the product's own. |
| `severity` | ENUM('error', 'warning', 'error_or_warning') | yes | What its rows report: error, warning, or error_or_warning when its rows say which. |
| `summary` | VARCHAR | yes | What it reports, in one sentence. |
| `explanation` | VARCHAR | yes | Why it matters, ending with how to fix what it reports. |
| `query` | VARCHAR | yes | The SELECT that finds the problems. |
| `kinds` | VARCHAR[] | no | The kinds it concerns. |

- **Key:** `name`
- **Rule:** `regexp_full_match("name", '[a-z0-9]+(-[a-z0-9]+)*')`
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

- **Key:** `product_id`
- **Rule:** `(max_children >= 1)`

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

<a id="relation-applies"></a>

### `applies`

The use case relies on the domain rule.

- **Reads:** Applies / Applied by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`use_case`](#kind-use_case) | [`domain_rule`](#kind-domain_rule) | The use case relies on the domain rule. |

<a id="relation-carries_out"></a>

### `carries_out`

The flow carries out the use case.

- **Reads:** Carries out / Carried out by flow
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`flow`](#kind-flow) | [`use_case`](#kind-use_case) | The flow carries out the use case. |

<a id="relation-covers"></a>

### `covers`

The test exercises the component.

- **Reads:** Covers / Covered by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`test`](#kind-test) | [`component`](#kind-component) | The test exercises the component. |

<a id="relation-deepens"></a>

### `deepens`

The technical flow says how the system carries out the flow.

- **Reads:** Deepens / Deepened by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`design_flow`](#kind-design_flow) | [`flow`](#kind-flow) | The technical flow says how the system carries out the flow. |

<a id="relation-depends_on"></a>

### `depends_on`

The component calls or imports the other.

- **Reads:** Depends on / Depended on by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`component`](#kind-component) | [`component`](#kind-component) | The component calls or imports the other. |

<a id="relation-follows"></a>

### `follows`

The use case or domain follows the pattern, and gives a value for each of its settings in setting_value rows.

- **Reads:** Follows / Followed by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`domain`](#kind-domain) | [`pattern`](#kind-pattern) | The whole domain follows the pattern, and so owes each of its rules. |
| [`use_case`](#kind-use_case) | [`pattern`](#kind-pattern) | The use case follows the pattern and gives a value for each of its settings. |

<a id="relation-fulfills"></a>

### `fulfills`

The flow, flow step, view, endpoint or interaction requirement carries out the obligation.

- **Reads:** Carries out / Carried out in
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`endpoint`](#kind-endpoint) | [`requirement`](#kind-requirement) | The endpoint carries out the requirement. |
| [`flow`](#kind-flow) | [`domain_rule`](#kind-domain_rule) | The flow carries out the domain rule. |
| [`flow`](#kind-flow) | [`interaction_requirement`](#kind-interaction_requirement) | The flow carries out the interaction requirement. |
| [`flow`](#kind-flow) | [`requirement`](#kind-requirement) | The flow carries out the requirement. |
| [`flow_step`](#kind-flow_step) | [`domain_rule`](#kind-domain_rule) | The step carries out the domain rule. |
| [`flow_step`](#kind-flow_step) | [`interaction_requirement`](#kind-interaction_requirement) | The step carries out the interaction requirement. |
| [`flow_step`](#kind-flow_step) | [`pattern_rule`](#kind-pattern_rule) | The step carries out the pattern rule. |
| [`flow_step`](#kind-flow_step) | [`requirement`](#kind-requirement) | The step carries out the requirement. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`domain_rule`](#kind-domain_rule) | The interaction requirement carries out the domain rule at a view, endpoint or flow. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`pattern_rule`](#kind-pattern_rule) | The interaction requirement carries out the pattern rule at its view, endpoint or flow. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`requirement`](#kind-requirement) | The interaction requirement carries out the use case requirement at a view, endpoint or flow. |
| [`view`](#kind-view) | [`requirement`](#kind-requirement) | The view carries out the requirement. |

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

<a id="relation-implements"></a>

### `implements`

The component serves the endpoint or renders the view.

- **Reads:** Implements / Implemented by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`component`](#kind-component) | [`endpoint`](#kind-endpoint) | The component serves the endpoint. |
| [`component`](#kind-component) | [`view`](#kind-view) | The component renders the view. |

<a id="relation-involves"></a>

### `involves`

The domain rule, under its domain, holds across this aggregate and the others it names.

- **Reads:** Involves / Involved in
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`domain_rule`](#kind-domain_rule) | [`aggregate`](#kind-aggregate) | The domain rule, under its domain, holds across this aggregate and the others it names. |

<a id="relation-meets"></a>

### `meets`

The component, test or technical step follows the standard rule.

- **Reads:** Meets / Met by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`component`](#kind-component) | [`standard_rule`](#kind-standard_rule) | The component follows the standard rule. |
| [`design_step`](#kind-design_step) | [`standard_rule`](#kind-standard_rule) | The design step follows the standard rule. |
| [`test`](#kind-test) | [`standard_rule`](#kind-standard_rule) | The test follows the standard rule. |

<a id="relation-proves"></a>

### `proves`

The test proves the obligation; this counts as proof.

- **Reads:** Proves / Proved by
- **Role:** proof

| From | To | Meaning |
| --- | --- | --- |
| [`test`](#kind-test) | [`domain_rule`](#kind-domain_rule) | The test proves the domain rule. |
| [`test`](#kind-test) | [`interaction_requirement`](#kind-interaction_requirement) | The test proves the interaction requirement. |
| [`test`](#kind-test) | [`pattern_rule`](#kind-pattern_rule) | The test proves the pattern rule, for the domain it sits in. |
| [`test`](#kind-test) | [`requirement`](#kind-requirement) | The test proves the requirement. |

<a id="relation-raised_by"></a>

### `raised_by`

The event is raised when that entity of its aggregate changes.

- **Reads:** Raised by / Raises
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`domain_event`](#kind-domain_event) | [`entity`](#kind-entity) | The event is raised when that entity of its aggregate changes. |

<a id="relation-reacts_to"></a>

### `reacts_to`

The aggregate changes, the use case starts or the component handles the event, which may come from another aggregate or domain.

- **Reads:** Reacts to / Reacted to by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`aggregate`](#kind-aggregate) | [`domain_event`](#kind-domain_event) | The aggregate changes in response to the event, which may come from another aggregate or domain. |
| [`component`](#kind-component) | [`domain_event`](#kind-domain_event) | The component handles the event. |
| [`use_case`](#kind-use_case) | [`domain_event`](#kind-domain_event) | The use case starts when the event happens. |

<a id="relation-refers_to"></a>

### `refers_to`

The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one).

- **Reads:** Refers to / Referred to by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one). |

<a id="relation-relates_to"></a>

### `relates_to`

One aggregate refers to another by ID.

- **Reads:** Relates to / Related to by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`aggregate`](#kind-aggregate) | [`aggregate`](#kind-aggregate) | One aggregate refers to another by ID. |

<a id="relation-runs"></a>

### `runs`

The test runs the flow end to end.

- **Reads:** Runs / Run by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`test`](#kind-test) | [`flow`](#kind-flow) | The test runs the flow end to end. |

<a id="relation-satisfies"></a>

### `satisfies`

The component or technical step designs the obligation; this counts as design.

- **Reads:** Satisfies / Designed by
- **Role:** design

| From | To | Meaning |
| --- | --- | --- |
| [`component`](#kind-component) | [`domain_rule`](#kind-domain_rule) | The component enforces the domain rule. |
| [`component`](#kind-component) | [`interaction_requirement`](#kind-interaction_requirement) | The component designs or implements the interaction requirement. |
| [`component`](#kind-component) | [`pattern_rule`](#kind-pattern_rule) | The component designs or implements the pattern rule, for the domain it sits in. |
| [`component`](#kind-component) | [`requirement`](#kind-requirement) | The component designs or implements the requirement. |
| [`design_step`](#kind-design_step) | [`domain_rule`](#kind-domain_rule) | The step enforces the domain rule, through the component it uses. |
| [`design_step`](#kind-design_step) | [`interaction_requirement`](#kind-interaction_requirement) | The step designs the interaction requirement, through the component it uses. |
| [`design_step`](#kind-design_step) | [`pattern_rule`](#kind-pattern_rule) | The step designs the pattern rule, for the domain it sits in, through the component it uses. |
| [`design_step`](#kind-design_step) | [`requirement`](#kind-requirement) | The step designs the requirement, through the component it uses. |

<a id="relation-supports"></a>

### `supports`

The test checks a mechanism that backs the obligation, such as a lock or a budget, without proving it; it never counts as proof.

- **Reads:** Supports / Supported by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`test`](#kind-test) | [`domain_rule`](#kind-domain_rule) | The test checks a mechanism that backs the domain rule without proving it. |
| [`test`](#kind-test) | [`interaction_requirement`](#kind-interaction_requirement) | The test checks a mechanism that backs the interaction requirement without proving it. |
| [`test`](#kind-test) | [`pattern_rule`](#kind-pattern_rule) | The test checks a mechanism that backs the pattern rule without proving it. |
| [`test`](#kind-test) | [`requirement`](#kind-requirement) | The test checks a mechanism that backs the use case requirement without proving it. |

<a id="relation-uses"></a>

### `uses`

The flow, step or view passes through, calls or is carried out by the view, endpoint or component.

- **Reads:** Uses / Used by
- **Role:** none

| From | To | Meaning |
| --- | --- | --- |
| [`design_step`](#kind-design_step) | [`component`](#kind-component) | The step is carried out by the component. |
| [`flow`](#kind-flow) | [`endpoint`](#kind-endpoint) | The flow calls the endpoint. |
| [`flow`](#kind-flow) | [`view`](#kind-view) | The flow passes through the view. |
| [`flow_step`](#kind-flow_step) | [`component`](#kind-component) | The step is carried out by the component. |
| [`flow_step`](#kind-flow_step) | [`endpoint`](#kind-endpoint) | The step calls the endpoint. |
| [`flow_step`](#kind-flow_step) | [`view`](#kind-view) | The step happens in the view. |
| [`view`](#kind-view) | [`endpoint`](#kind-endpoint) | The view calls the endpoint. |

## Folders

The folders kinds sit in, in stage then order.

<a id="folder-domain-model"></a>

### Domain model (`domain-model`)

The aggregates and their domain rules.

- **Stage:** Define, order 1
- **Kinds:** [`aggregate`](#kind-aggregate), [`entity`](#kind-entity), [`domain_event`](#kind-domain_event), [`domain_rule`](#kind-domain_rule)

<a id="folder-use-cases"></a>

### Capabilities (`use-cases`)

Capabilities, the use cases in them, and their UC requirements.

- **Stage:** Define, order 2
- **Kinds:** [`capability`](#kind-capability), [`use_case`](#kind-use_case), [`requirement`](#kind-requirement)

<a id="folder-interaction-design"></a>

### Interaction design (`interaction-design`)

Flows and their steps, views, APIs and their endpoints, integrations, and interaction requirements.

- **Stage:** Design, order 1
- **Kinds:** [`flow`](#kind-flow), [`flow_step`](#kind-flow_step), [`view`](#kind-view), [`api`](#kind-api), [`endpoint`](#kind-endpoint), [`integration`](#kind-integration), [`interaction_requirement`](#kind-interaction_requirement)

<a id="folder-technical-specification"></a>

### Technical specification (`technical-specification`)

The components of the target design, in their layers, and the technical flows that use them.

- **Stage:** Design, order 2
- **Kinds:** [`layer`](#kind-layer), [`component`](#kind-component), [`design_flow`](#kind-design_flow), [`design_step`](#kind-design_step)

<a id="folder-test-plan"></a>

### Test plan (`test-plan`)

The tests that prove the obligations.

- **Stage:** Design, order 3
- **Kinds:** [`test`](#kind-test)

<a id="folder-shared"></a>

### Shared (`shared`)

What a product's domains share: patterns, standards and their rules.

- **Stage:** Product level, order 1
- **Kinds:** [`pattern`](#kind-pattern), [`pattern_rule`](#kind-pattern_rule), [`standard`](#kind-standard), [`standard_rule`](#kind-standard_rule)

## Checks

Every check: Lathe's, in the order they run, then the engine's own, then the product's.

<a id="check-test-file-missing"></a>

### `test-file-missing`

**Error or warning** · Lathe's · Kinds: [`test`](#kind-test)

A test's `file`, and its `key_file` when it names one, exists.

For an automated or manual test a missing file is an error. A planned test may name the file it will live in, so for it a missing file is a warning, as for a component whose file does not exist yet. A `key_file` (the file that holds the test's key, when the test runs from a shared class in another file) must be a file under the product root; one outside it is always an error. Fix the path (relative to the repo root), or write the file.

<a id="check-test-file-missing-id"></a>

### `test-file-missing-id`

**Error** · Lathe's · Kinds: [`test`](#kind-test)

An automated test's file names the test, so the code can be traced back to it.

The file must name the test's own ID, or else every ID the test proves (each target of a relation whose role is `proof`); a missing proved ID is proof-not-in-file. This check reports the two cases that leave no proved ID to name: a test with a `key` whose file does not contain that key text (the ID rules then do not apply), and a test that proves no record and whose file does not name its own ID.

A test that proves no record but `supports` one (a check of a mechanism that backs an obligation without proving it) is not reported: support is never proof, so its file owes no ID. A test with a `key_file` is judged by that file instead of `file`; a key file that is missing or outside the root is test-file-missing only. Manual and planned tests are not checked here. Put the test's ID in the test's name in the file, or fix its `key` or `key_file`.

<a id="check-unsatisfied"></a>

### `unsatisfied`

**Warning** · Lathe's · Kinds: [`requirement`](#kind-requirement), [`domain_rule`](#kind-domain_rule), [`interaction_requirement`](#kind-interaction_requirement), [`pattern_rule`](#kind-pattern_rule)

An obligation that no design link targets yet.

An obligation is any record of a kind the schema marks as one (the obligation supertype). A proof-only obligation kind, such as a pattern rule, asks for no design, so it is never reported. An obligation of a full kind is owed by its domain and designed by a link of a `design` relation such as `satisfies`, as coverage counts it (coverage_item). Link a component to it with `satisfies`, or another design relation.

<a id="check-unproved"></a>

### `unproved`

**Warning** · Lathe's · Kinds: [`requirement`](#kind-requirement), [`domain_rule`](#kind-domain_rule), [`interaction_requirement`](#kind-interaction_requirement), [`pattern_rule`](#kind-pattern_rule)

An obligation that no automated or manual test proves yet.

A test proves an obligation through a `proof` link such as `proves`; a planned test is not proof. A pattern rule is owed by the domains owed_pattern_rules names (each domain that follows its pattern, unless the rule is not applicable or waived there), and only a test in that domain proves it there, so it is reported once for each domain that owes it and lacks one. An automated test's proof counts only when its file backs it, as in coverage: the file names the test's own ID (or its key), or names that target; an unbacked claim is also a proof-not-in-file error. Write a test that `proves` it, and name the test in its file.

<a id="check-use-case-without-requirements"></a>

### `use-case-without-requirements`

**Warning** · Lathe's · Kinds: [`use_case`](#kind-use_case)

A use case with no requirements under it yet.

A use case's requirements are the rules it must follow, so one with none says nothing checkable. A use case that follows a pattern is left out: its rules come from the pattern's rules, so it may have no requirements of its own. Add requirements under it, or have it follow the pattern it applies.

<a id="check-component-file-missing"></a>

### `component-file-missing`

**Warning** · Lathe's · Kinds: [`component`](#kind-component)

A component whose file does not exist yet.

The design may name a file before it is written, so this is work to do, not breakage. Write the file, or fix the path (relative to the repo root).

<a id="check-use-case-outside-capability"></a>

### `use-case-outside-capability`

**Warning** · Lathe's · Kinds: [`use_case`](#kind-use_case), [`capability`](#kind-capability)

Once a domain has capabilities, each of its use cases sits in one of them.

A use case left directly under the domain is missing from the domain's use case index. Move it under one of the domain's capabilities; its ID does not change. A domain with no capabilities is not reported.

<a id="check-pattern-setting-missing"></a>

### `pattern-setting-missing`

**Error** · Lathe's · Kinds: [`use_case`](#kind-use_case), [`pattern`](#kind-pattern)

A use case that follows a pattern gives each of the pattern's settings.

Each setting of the pattern (a pattern_setting row) needs a setting_value row from each use case that follows it: a value, or a reason it is not applicable. A domain that follows a pattern gives no settings. Give the missing setting a value, or say why it is not applicable.

<a id="check-pattern-not-followed"></a>

### `pattern-not-followed`

**Warning** · Lathe's · Kinds: [`pattern`](#kind-pattern)

A pattern that no use case and no domain follows.

No domain owes its rules, so they count in no domain's coverage. Link the use cases or domains that apply it with `follows`, or remove the pattern if nothing needs it.

<a id="check-obligation-outside-domain"></a>

### `obligation-outside-domain`

**Warning** · Lathe's

An obligation that sits in no domain.

It counts in no domain's coverage, so it is reported rather than silently dropped. Lathe's own obligation kinds always sit in a domain, except a pattern rule under its pattern, which each domain that follows the pattern owes (pattern-not-followed reports a pattern nobody follows); a product's own obligation kind may not. Move the record under a domain, or declare its kind under one.

<a id="check-proof-not-in-file"></a>

### `proof-not-in-file`

**Error** · Lathe's · Kinds: [`test`](#kind-test)

An automated test's file names every ID the test proves, unless it names the test's own ID.

Each target of a relation whose role is `proof` must appear in the file, as a whole ID, when the file does not name the test's own ID. Each proved ID the file leaves out is one error. A test whose file names its own ID vouches for all its claims; a test with a `key` is checked by test-file-missing-id instead. A test with a `key_file` is judged by that file; a key file that is missing or outside the root is test-file-missing only. A `supports` link is not a proof claim, so its target need not appear. Manual and planned tests are not checked here. Name the ID in the test's name in the file, name the test's own ID there, or remove the claim.

<a id="check-rule-not-applied"></a>

### `rule-not-applied`

**Warning** · Lathe's · Kinds: [`domain_rule`](#kind-domain_rule)

A domain rule that no use case applies.

A rule that nothing applies is either missing from a use case's `applies` links or no longer needed. Link the use cases that rely on it with `applies`, or remove the rule.

<a id="check-use-case-without-flow"></a>

### `use-case-without-flow`

**Warning** · Lathe's · Kinds: [`use_case`](#kind-use_case), [`flow`](#kind-flow)

Once a domain has flows, each of its use cases is carried out by one.

A flow names the use cases it carries out with `carries_out`. A domain with no flows is not reported: its interaction design has not started. Link the flow that carries the use case out, or write a flow for it.

<a id="check-interaction-requirement-fulfills-nothing"></a>

### `interaction-requirement-fulfills-nothing`

**Warning** · Lathe's · Kinds: [`interaction_requirement`](#kind-interaction_requirement)

An interaction requirement names what it carries out.

An interaction requirement carries out a use case's requirement, a domain rule or a pattern rule at a view, endpoint or flow, so it links what it carries out with `fulfills`. Add the `fulfills` link.

<a id="check-test-type-mismatch"></a>

### `test-type-mismatch`

**Warning** · Lathe's · Kinds: [`test`](#kind-test)

A test's `test_type` does not suit what it proves.

Kept conservative: only a test of type domain_rule that proves requirements and no domain rule, or a test of type acceptance that proves domain rules and no requirement, is reported. A unit test may prove either, so it is not reported, nor is any other type, nor a test that proves both. Change the type, or what the test proves.

<a id="check-step-order"></a>

### `step-order`

**Error** · Lathe's · Kinds: [`flow_step`](#kind-flow_step), [`design_step`](#kind-design_step)

The steps on each path of a flow are numbered 1, 2, 3 and so on, without gaps.

The steps of a flow (flow_step) and of a technical flow (design_step) are read in `position` within their `path`, a short name such as main or refused, compared trimmed and in any letter case. The schema gives each step a whole number that no other step on its path has; a path whose positions skip a number is reported once, on the first step after the gap. Renumber the steps of the path to close the gap.

<a id="check-flow-step-fulfills-outside-flow"></a>

### `flow-step-fulfills-outside-flow`

**Warning** · Lathe's · Kinds: [`flow_step`](#kind-flow_step), [`flow`](#kind-flow)

A flow step fulfills something its flow does not carry out.

A step carries out part of its flow, so what it fulfills belongs to a use case the flow carries out. For a step under flow F, a `fulfills` target is inside F when it is a requirement of a use case F carries out; a domain rule one of those use cases applies; a rule of a pattern one of them, or F's domain, follows; or an interaction requirement that fulfills one of these, or that sits under F itself. Anything else is reported. A step whose flow carries out no use case is left out. Add the use case to the flow's `carries_out`, or move the link to a step of the flow that carries it out.

<a id="check-flow-fulfills-differs-from-steps"></a>

### `flow-fulfills-differs-from-steps`

**Warning** · Lathe's · Kinds: [`flow`](#kind-flow), [`flow_step`](#kind-flow_step)

A flow with steps fulfills something none of its steps fulfills.

Once a flow has steps, what the flow fulfills is the union of what its steps fulfill, so each `fulfills` link belongs on the step that does it. A flow with steps may leave its own `fulfills` out: its steps' links are enough. Move the link onto the step that carries it out.

<a id="check-proof-still-owed"></a>

### `proof-still-owed`

**Warning** · Lathe's · Kinds: [`test`](#kind-test)

An obligation that is already proved, but that a planned test is also meant to prove.

Coverage counts these in `planned_any` but not in `planned`; this check names each one, with the planned test that still owes its proof, so the list behind `planned_any` is never only a count. An obligation not yet proved whose test is only planned is reported by unproved instead. Proof is judged as coverage judges it (coverage_item): a pattern rule is owed per domain, and only tests in that domain prove it there or owe it there. Write the planned test, or drop its claim if the proof it owes is already made.

<a id="check-proof-counts-nowhere"></a>

### `proof-counts-nowhere`

**Warning** · Lathe's · Kinds: [`test`](#kind-test)

A test whose proofs count in no domain's coverage.

A test's proof of a target counts, as in coverage, when the target is an obligation in a domain, or a pattern rule owed by the domain the test sits in (owed_pattern_rules: a domain owes a pattern rule when it follows the pattern itself, or when one of its use cases does, unless the rule is not applicable or waived there). A test is reported when it has at least one `proof` link and none of its proofs counts; the message says why for each target. The test's state does not matter: a planned test that will prove nothing counted is reported too. Point the test at an obligation that counts, or move it into the domain that owes the rule.

<a id="check-manual-test-file-silent"></a>

### `manual-test-file-silent`

**Warning** · Lathe's · Kinds: [`test`](#kind-test)

A manual test whose file exists but never mentions it.

Nothing ties the file to the test: it names neither the test's ID, nor any ID the test proves (each target of a relation whose role is `proof`), nor the test's `key` when it has one. Manual tests are not held to the automated rules (test-file-missing-id, proof-not-in-file), so a silent file is a warning: the steps a person follows should say which test they carry out. A test with a `key_file` is judged by that file instead. A missing file is test-file-missing instead. Name the test in the file, or point its `file` at the file that carries it out.

<a id="check-section-stage-mismatch"></a>

### `section-stage-mismatch`

**Error** · Lathe's

A kind's folder belongs to the kind's own stage.

A Define kind sits in a Define folder and a Design kind in a Design folder. A product-level folder, with no stage (such as shared), may hold a kind of any stage. Lathe's own kinds always fit; a product's own kind may not. Change the product kind's `section` or `stage`.

<a id="check-layer-order"></a>

### `layer-order`

**Error** · Lathe's · Kinds: [`layer`](#kind-layer)

A layer's position is one that no other layer beside it has.

Layers beside each other share a parent: the domain, or the layer that holds them as sub-layers. Layers in different domains, and sub-layers of different layers, may share a position. Give each layer beside the others its own position.

<a id="check-component-outside-layer"></a>

### `component-outside-layer`

**Warning** · Lathe's · Kinds: [`component`](#kind-component), [`layer`](#kind-layer)

Once a domain has layers, each of its components sits in one of them.

This works as use cases sit in capabilities. A domain with no layers may hold its components itself. Move the component into one of the domain's layers; its ID does not change.

<a id="check-too-many-children"></a>

### `too-many-children`

**Warning** · Lathe's

A record with more children of one kind than its product's max_children setting.

The setting is the product's product_setting row (15 when it has none). A parent with that many children of one kind is missing a level between them, such as a capability, a layer or another aggregate. Children are counted per kind. Tests are exempt: the app groups them by what they prove, so they are never shown as one list. The steps of a flow or a technical flow are counted per path, since each path reads as its own list, and requirements, interaction requirements, pattern rules and standard rules per `group_name`, since each group reads under its own heading; the ungrouped ones are one list. Paths and groups are compared trimmed and in any letter case. Add a level, or a group, and move the children into it.

<a id="check-lone-child"></a>

### `lone-child`

**Warning** · Lathe's · Kinds: [`capability`](#kind-capability), [`layer`](#kind-layer), [`requirement`](#kind-requirement), [`interaction_requirement`](#kind-interaction_requirement), [`pattern_rule`](#kind-pattern_rule), [`standard_rule`](#kind-standard_rule)

A capability, a layer or a group with exactly one child, of any kind.

A level that holds one record groups nothing. Only its own children are counted, not theirs, and one with no children is not reported. A group (the `group_name` of requirements, interaction requirements, pattern rules and standard rules) is counted among its parent's children of one kind, compared trimmed and in any letter case, and reported on that parent. Merge it into a neighbor, or give it more.

<a id="check-entity-fields"></a>

### `entity-fields`

**Error** · Lathe's · Kinds: [`entity`](#kind-entity), [`domain_event`](#kind-domain_event)

Each entity lists the fields it keeps, and each domain event the fields it carries.

An entity's fields are its entity_field rows and a domain event's its event_field rows, each with a name, a meaning and a type, so the domain model says what each record holds. An entity or event with none says nothing about its data. Add its fields.

<a id="check-has-crosses-aggregate"></a>

### `has-crosses-aggregate`

**Error** · Lathe's · Kinds: [`entity`](#kind-entity)

A `has_one` or `has_many` link stays inside its aggregate.

These relations link an entity to its parts, and parts belong to their aggregate, so both ends sit in the same aggregate. Only `refers_to` may cross aggregates and domains. Use `refers_to`, or move the part into the aggregate.

<a id="check-entity-unreferenced"></a>

### `entity-unreferenced`

**Warning** · Lathe's · Kinds: [`entity`](#kind-entity)

A child entity that its aggregate's root does not reach.

Each child entity is a part of its aggregate's root, so a `has_one` or `has_many` reaches it from the root, directly or through other children of the same aggregate. Links that cross aggregates (has-crosses-aggregate) and `refers_to` links do not count. Link the child from the root or from another child with `has_one` or `has_many`.

<a id="check-event-unheard"></a>

### `event-unheard`

**Warning** · Lathe's · Kinds: [`domain_event`](#kind-domain_event), [`aggregate`](#kind-aggregate), [`use_case`](#kind-use_case), [`component`](#kind-component)

A domain event that nothing reacts to.

An event is worth naming when something changes because it happened: an aggregate, which may sit in another aggregate or domain, a use case that starts, or a component that handles it, each linking to the event with `reacts_to`. An event kept only for the record can be fine, so this is a warning. Link what changes, starts or runs when the event happens to it with `reacts_to`, or leave the event unheard on purpose.

<a id="check-event-tense"></a>

### `event-tense`

**Warning** · Lathe's · Kinds: [`domain_event`](#kind-domain_event)

A domain event's title reads as something that happened, in the past tense.

An event is named for what happened, such as Loan opened or Payment sent. The check is a heuristic over the title's words, in any letter case and split at anything but a letter: the title passes when its last word, or any word after its first (the word after a one-word subject, as in Loan became overdue), is a past form. A past form is a word of four or more letters ending in "-ed", other than the few such words that are not verbs in the past (need, seed, feed, speed, breed, bleed, embed, proceed, exceed, succeed, hundred, naked, sacred, wicked), or one of the irregular past forms the query lists. The heuristic can miss a past form it does not know, so this is a warning. Name the event in the past tense, as what happened (Tool returned, not Return tool), or add the word to the check's list if it is a past form the check does not know.

<a id="check-raised-by-outside-aggregate"></a>

### `raised-by-outside-aggregate`

**Error** · Lathe's · Kinds: [`domain_event`](#kind-domain_event), [`entity`](#kind-entity)

A domain event's `raised_by` names an entity of the event's own aggregate.

An event is raised by its aggregate, so the entity whose change raises it is one of that aggregate's entities. What another aggregate does about the event is said by its `reacts_to`. Point `raised_by` at an entity of the event's aggregate, or move the event under the aggregate that raises it.

<a id="check-domain-named-for-technology"></a>

### `domain-named-for-technology`

**Warning** · Lathe's · Kinds: [`domain`](#kind-domain)

A domain is named for a technology layer or delivery channel rather than a business capability.

A domain is a vertical slice of business capability: it owns its records and rules, its views, its code and its tests, and technology is a layer inside its Design stage. A domain whose title or domain code (its ID after the product prefix, such as LEND in TL-LEND) names a technology splits one capability across several domains. The words are web app, frontend, front end, backend, back end, API, UI, server, database, DB, desktop, mobile, engine, infrastructure, infra and Electron, matched as whole words in any letter case, with or without a space or hyphen inside the two-word ones, and in the plural. Only the title and code are read, never the description. Name the domain for the capability it serves, and make the technology a layer in each domain's Design stage.

<a id="check-domain-rule-involves"></a>

### `domain-rule-involves`

**Warning** · Lathe's · Kinds: [`domain_rule`](#kind-domain_rule), [`aggregate`](#kind-aggregate)

A domain rule under its domain names the aggregates it ties together with `involves`; a rule under an aggregate or entity names none.

A domain rule sits on the aggregate, or the entity, it is about. One that holds across aggregates, such as two records saved together or a lifecycle rule for every record in the domain, sits under the domain alone (no aggregate_id) and says with `involves` which aggregates it ties together. Such a rule is reported when it involves fewer than two aggregates: a rule about one aggregate belongs under that aggregate. It is also reported, once per link, for each aggregate it involves from another domain, since a rule across domains is a domain event's job: one domain raises the event and the other reacts to it. A rule under an aggregate or an entity that uses `involves` is reported too, since its place already says what it is about. Name the aggregates, move a one-aggregate rule under its aggregate, or drop the link.

<a id="check-component-satisfies-nothing"></a>

### `component-satisfies-nothing`

**Warning** · Lathe's · Kinds: [`component`](#kind-component)

A component that satisfies no obligation.

A component exists to design or implement something the product owes, so it links each obligation it serves with a link of a `design` relation such as `satisfies`. One with no such link has no purpose the spec can see: it is a leftover, or its purpose is unwritten. Shared infrastructure is no exception: link the requirements, domain rules or pattern rules it makes possible. Link what the component designs or implements with "satisfies", or remove it.

<a id="check-test-proves-nothing"></a>

### `test-proves-nothing`

**Warning** · Lathe's · Kinds: [`test`](#kind-test)

A test that proves, and supports, nothing.

A test exists to prove obligations (a link of a `proof` relation such as `proves`) or to check a mechanism that backs one (`supports`). One with neither has no purpose the spec can see: running a flow (`runs`) or exercising a component (`covers`) says what it touches, not what it shows. Link the obligation it proves with "proves", or the one it backs with "supports", or remove the test.

<a id="check-standard-rule-unmet"></a>

### `standard-rule-unmet`

**Warning** · Lathe's · Kinds: [`standard_rule`](#kind-standard_rule), [`standard`](#kind-standard), [`component`](#kind-component), [`test`](#kind-test)

A standard rule that nothing meets.

A standard rule asks nothing of a domain, so it owes no coverage, but a rule that no component, technical step or test `meets` has no use the spec can see, and nothing outlives its purpose. Link what follows the rule to it with `meets`, or remove the rule.

<a id="check-design-flow-deepens-nothing"></a>

### `design-flow-deepens-nothing`

**Warning** · Lathe's · Kinds: [`design_flow`](#kind-design_flow)

A technical flow that deepens no flow.

A technical flow says how the system carries out a flow, so it names that flow with `deepens`. One that deepens nothing is design with no flow to carry out: the flow is missing, or the link is. Link the flow it carries out with `deepens`, or write the flow first.

<a id="check-data-refused"></a>

### `data-refused`

**Error** · the engine

Every data file loads: the store accepts every row of data/ with every key and rule of the schema.

A row that breaks the schema (a missing parent, a link to a record that does not exist, a value outside its enum, an ID used twice) is refused when the data loads, and nothing is checked until it is fixed. Each refusal names the file, the line and the rule it broke. Fix the row through the CLI or the app, or resolve the merge that brought it.
