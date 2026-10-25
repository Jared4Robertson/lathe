# Lathe spec format

Lathe stores a product's specifications as **records**: one Markdown file per record, with a YAML header for its structured fields. The files are the source of truth, readable and reviewable in git. The engine loads them into DuckDB, checks them against the **meta-model** (the kinds, relations and folders in [meta/](meta/)), computes traceability and serves them to the web app.

This page gives the ideas. The facts (every kind, relation, folder and check) are generated from the meta-model and the check files into the reference: run `lathe format`, or read [REFERENCE.md](REFERENCE.md), which carries this page followed by them.

## 1. Where records live

Records live in the product's repo, in the specs folder its `lathe.config.json` names (default `specs/`; see the [package README](README.md)). Every `*.md` file there is a record, except files named `README.md`. Folder names are for people, such as `tool-library/lending/01-define/use-cases/UC01-borrow-a-tool.md`: the engine relies only on each record's fields.

## 2. Record file

```markdown
---
id: TL-LEND-UC01
kind: use_case
title: Borrow a tool
parent: TL-LEND
actor: Member
links:
  applies: [TL-LEND-DR01, TL-LEND-DR02]
---
A member borrows an available tool for a fixed loan period.
```

Every record has an `id` (unique, matching `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`, never reused or renumbered), a `kind`, a `title`, and a `parent` (except a product) of a kind its kind allows. Its kind may require more plain fields, such as `actor`; any other plain field is kept. `links` maps a relation name to target IDs, each allowed by the meta-model for the two kinds; each relation has a label read from either end, such as Satisfies and Designed by, which the reference shows. The body is Markdown; rules and requirements state their rule with MUST, MUST NOT, SHOULD or MAY. A product may carry an `icon` and a `color` for the app's space rail. Specs name roles, never people: a use case's `actor` and a question's `owner` are roles such as Owner, Reader or Agent.

## 3. ID convention

An ID is the product prefix, the domain code, then a kind code and number, such as `TL-LEND-UC01`; a record that belongs to another takes its ID and adds a part, such as the requirement `TL-LEND-UC01-R01`. The engine checks only the format and uniqueness; the convention keeps IDs readable. Each kind's pattern is in `meta/ids.csv` and in the reference.

## 4. Code traceability

A `test` has a `state`: `automated` (the default), `manual` or `planned`. An automated test names the file that runs it in `run_by`, and that file names the test's own ID, or else every ID it proves, as whole IDs; a `key` field gives other text the file must contain instead. When the test runs from a shared class in another file, `key_file` names the file that holds the key (or the IDs), under the product root, and that file is read instead of `run_by`, which must still exist. A test `proves` what it is proof of; it `supports` an obligation when it checks a mechanism that backs it, such as a lock or a budget, without proving it, and support never counts as proof. A manual test describes its procedure in its body. A planned test shows what is meant to prove an obligation, but is not proof. A `component` names its code in `file`, which may not exist yet.

## 5. Checks

Each check is one SQL file in `lathe/checks/`: a `SELECT` over the loaded tables that returns rows of `(severity, check, record, message)`. Its name is its file name without the number and `.sql`. An **error** means the workspace is broken, and `lathe check` exits non-zero; a **warning** is work still to do, such as an obligation not yet proved, two stages that do not join up yet, or a level of the spec that is the wrong size: a record with more children of one kind than `structure.maxChildren` in `lathe.config.json` (default 15), or a capability or layer with only one child. One mistake gives one error.

A check documents itself in its header comment: one summary sentence, a blank comment line, the explanation ending with how to fix what it reports, a blank comment line, then `-- severity: error` (or `warning`, or `error, warning`) and an optional `-- kinds:` line naming the kinds it concerns. The reference is built from these headers, and `undocumented` reports a check, kind or relation that lacks its text.

## 6. Coverage

A kind's `obligation` says what it asks: `yes`, an obligation that must be designed, built and proved; `proof`, one that needs proof only; anything else, none. A relation's `role` says what a link does: `design` (a component `satisfies` it) or `proof` (a test `proves` it). Each obligation is counted in the domain that owes it, as **designed**, **built** (designed by a component whose file exists), **proved** (by an automated or manual test) and **planned**, with its gaps.

## 7. Fitness

A `fitness` record is the owner's judgment, the person who decides what the product is for: on a `date`, a `score` from 1 (does not serve its purpose) to 5 (serves it fully), and in the body the experiences behind it. Lathe never writes these itself. What it can count (coverage, open questions, checks) is evidence for that judgment, never the score.

## 8. What records do not carry

Records carry no status, approval or decision history: a record in the specs is in force, uncertainty is an open `question`, and git keeps the history. A decided question is removed and its answer written into the records it affects.

## 9. Extending the meta-model

A product adds to the meta-model with a `metaExtensions` folder holding a `kinds.csv`, `relations.csv`, `sections.csv` and/or `ids.csv` with the same columns. A new row is added as it is. A row for a kind, folder or relation rule that already exists changes it: a kind's `parent_kinds` and `required_fields` are widened, and any other non-empty value replaces the default's. Once the extensions are merged, every kind and relation needs a `description`, and every relation a `forward_label` and a `reverse_label` (`undocumented` and `relation-unlabeled` otherwise). The product's reference shows the result.

## 10. Capabilities and patterns

A domain with more than a handful of use cases groups them into **capabilities**, ordered slices through Define and Design: a use case, flow or test may sit under a capability instead of the domain, and still counts in the domain. Behavior that several use cases share is written once as a **pattern** under the product, with **settings** each following use case fills in. A use case `follows` a pattern and gives each setting as a header field, a value or `Not applicable:` with a reason; a domain may follow a pattern too.

## 11. Pattern rules

A pattern's rules are `pattern_rule` records under it. Each domain that follows the pattern, itself or through a use case, owes each rule and proves it with its own tests; by default a rule needs proof only. A rule that names a `setting` does not apply in a domain whose following use cases all give that setting as Not applicable.

## 12. Citing records in prose

A record's body may cite other records by ID, such as "the loan follows TL-LEND-DR05", so that a renamed or removed record does not leave a stale reference. A citation is a whole ID-shaped token that is a record's ID or starts with a known prefix (every product and domain ID, and `idPrefixes` in `lathe.config.json`). A bare product or domain ID counts only as a code span holding just that ID, and other code is not read. The cited IDs that exist are the record's **mentions**. Mentions are not links: they count for nothing.

## 13. A product's own checks

A product keeps its house rules as checks of its own: `lathe.config.json` names a folder in `checks`, and every `*.sql` file in it runs after Lathe's, over the same tables, with the same row contract and the same header. A product check named like one of Lathe's is not run. Its checks appear in the product's reference with Lathe's.

## 14. Flow steps

A flow can be written as `flow_step` records under it, in `order`: each says what happens, `uses` the view, endpoint or component it goes through, and `fulfills` what it carries out. A flow with more than one path, such as an API path or a refused path beside the main one, names each step's `path`; a step with no path is on the main path. The steps of each path are numbered 1, 2, 3 and so on. Once a flow has steps, what it fulfills is what its steps fulfill.

## 15. Folders

A domain's specs are laid out in folders by stage: in Define, the domain model and use cases; in Design, interaction design, technical specification and the test plan; and at product level what domains share. `meta/sections.csv` names these folders and each kind's `section` says which one it sits in, so the app reads the same way whatever folders the files are in. The app groups the test plan by what each test proves: acceptance, domain rule, pattern, interaction and engineering tests.

## 16. Layers

A domain's components are grouped into **layers**, ordered parts of its technical specification such as Models, Services or Web app, as its use cases are grouped into capabilities. A layer may hold sub-layers, each a layer under it with its own order among them. A component in a layer, at any depth, still belongs to the layer's domain everywhere a domain matters. Layers are records, so each product names its own.

## 17. Entities and the ERD

An aggregate is drawn as an ERD of the records it keeps. Each is an `entity` under the aggregate: one `root`, the record the aggregate is named for, and any number of `child` parts. Its body lists its fields in a table under a `## Fields` heading, with the columns Field, Meaning, Kind of value and Example; the Meaning column may also be called Business meaning. A domain rule about one entity may sit under that entity rather than the aggregate, and still belongs to the aggregate and its domain. `has_one` and `has_many` link an entity to its parts inside the aggregate; `refers_to` may cross aggregates and domains. The app draws a domain's ERD at aggregate level and each aggregate's ERD with its entities.

## 18. Domain events

A `domain_event` is an unchangeable record that something happened in the domain, named in the past tense (Loan opened, Tool returned). It sits under the aggregate that raises it, and `raised_by` may name the entity of that aggregate whose change raises it; an event raised by time passing, or in an aggregate with no entities, has none. Its body says in a sentence what happened, then lists what the event carries in a `## Fields` table with the same columns as an entity's. What happens next is said by the records that react: an aggregate that changes, a use case that starts or a component that handles the event links to it with `reacts_to`, from any aggregate or domain. An event that nothing reacts to is reported as a warning, since that can be fine but is often a missing link.

<!-- Everything below is generated from the meta-model and the check files by `lathe format`. Do not edit it here. -->

## Kinds

Every kind of record, after the product's extensions, from `meta/kinds.csv` and `meta/ids.csv`.

<a id="kind-product"></a>

### Product (`product`)

A product: the root of a set of specifications.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** none (a root record)
- **Children:** [`domain`](#kind-domain), [`pattern`](#kind-pattern), [`question`](#kind-question), [`fitness`](#kind-fitness)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>`, such as `TL`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`product-has-parent`](#check-product-has-parent)

<a id="kind-domain"></a>

### Domain (`domain`)

A part of the product with its own model, language and owner.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** [`product`](#kind-product)
- **Children:** [`capability`](#kind-capability), [`aggregate`](#kind-aggregate), [`domain_rule`](#kind-domain_rule), [`use_case`](#kind-use_case), [`flow`](#kind-flow), [`view`](#kind-view), [`endpoint`](#kind-endpoint), [`layer`](#kind-layer), [`component`](#kind-component), [`test`](#kind-test), [`question`](#kind-question)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-<D>`, such as `TL-LEND`
- **Links out:** Follows ([`follows`](#relation-follows))
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="kind-capability"></a>

### Capability (`capability`)

An ordered slice of a domain that groups its use cases, flows and tests, such as Membership or Lending. Its order is a whole number giving its place in the domain.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`domain`](#kind-domain)
- **Children:** [`use_case`](#kind-use_case), [`flow`](#kind-flow), [`test`](#kind-test)
- **Required fields:** `order`
- **Obligation:** no
- **ID:** `<P>-<D>-CAP<nn>`, such as `TL-LEND-CAP01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`capability-order`](#check-capability-order), [`use-case-outside-capability`](#check-use-case-outside-capability), [`lone-child`](#check-lone-child)

<a id="kind-aggregate"></a>

### Aggregate (`aggregate`)

A cluster of records changed together as one unit, with its own identity and rules.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`domain`](#kind-domain)
- **Children:** [`entity`](#kind-entity), [`domain_event`](#kind-domain_event), [`domain_rule`](#kind-domain_rule), [`question`](#kind-question)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-<D>-A<n>`, such as `TL-LEND-A1`
- **Links out:** Relates to ([`relates_to`](#relation-relates_to)), Reacts to ([`reacts_to`](#relation-reacts_to))
- **Links in:** Related to by ([`relates_to`](#relation-relates_to)), Questions about this ([`about`](#relation-about))
- **Checks:** [`aggregate-root`](#check-aggregate-root), [`event-unheard`](#check-event-unheard)

<a id="kind-entity"></a>

### Entity (`entity`)

A record the domain keeps, as one box of an aggregate's ERD: the aggregate's root (role: root) or one of its children (role: child). Its body holds a Fields table: Field, Meaning (or Business meaning), Kind of value, Example. The domain rules about it may sit under it.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`aggregate`](#kind-aggregate)
- **Children:** [`domain_rule`](#kind-domain_rule)
- **Required fields:** `role`
- **Obligation:** no
- **ID:** `<P>-<D>-EN<nn>`, such as `TL-LEND-EN01`
- **Links out:** Has one ([`has_one`](#relation-has_one)), Has many ([`has_many`](#relation-has_many)), Refers to ([`refers_to`](#relation-refers_to))
- **Links in:** Questions about this ([`about`](#relation-about)), Part of ([`has_one`](#relation-has_one)), Part of ([`has_many`](#relation-has_many)), Referred to by ([`refers_to`](#relation-refers_to)), Raises ([`raised_by`](#relation-raised_by))
- **Checks:** [`entity-role`](#check-entity-role), [`aggregate-root`](#check-aggregate-root), [`entity-fields`](#check-entity-fields), [`has-crosses-aggregate`](#check-has-crosses-aggregate), [`entity-unreferenced`](#check-entity-unreferenced), [`raised-by-outside-aggregate`](#check-raised-by-outside-aggregate)

<a id="kind-domain_event"></a>

### Domain event (`domain_event`)

An unchangeable record that something happened in the domain, raised by its aggregate and named in the past tense (Loan opened). Its body holds a Fields table of what it carries: Field, Meaning (or Business meaning), Kind of value, Example.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`aggregate`](#kind-aggregate)
- **Children:** none
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-<D>-EV<nn>`, such as `TL-LEND-EV01`
- **Links out:** Raised by ([`raised_by`](#relation-raised_by))
- **Links in:** Questions about this ([`about`](#relation-about)), Reacted to by ([`reacts_to`](#relation-reacts_to))
- **Checks:** [`entity-fields`](#check-entity-fields), [`event-unheard`](#check-event-unheard), [`event-tense`](#check-event-tense), [`raised-by-outside-aggregate`](#check-raised-by-outside-aggregate)

<a id="kind-domain_rule"></a>

### Domain rule (`domain_rule`)

A fact that must always hold for an aggregate's records, whatever use case changes them. It sits under the aggregate, under the entity of that aggregate it is about, or under the domain when it holds across aggregates.

- **Stage:** Define
- **Folder:** [Domain model](#folder-domain-model)
- **Parents:** [`aggregate`](#kind-aggregate), [`domain`](#kind-domain), [`entity`](#kind-entity)
- **Children:** none
- **Required fields:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<P>-<D>-DR<nn>`, such as `TL-LEND-DR01`
- **Links out:** none
- **Links in:** Applied by ([`applies`](#relation-applies)), Carried out in ([`fulfills`](#relation-fulfills)), Designed by ([`satisfies`](#relation-satisfies)), Proved by ([`proves`](#relation-proves)), Questions about this ([`about`](#relation-about)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`obligation-outside-domain`](#check-obligation-outside-domain), [`rule-not-applied`](#check-rule-not-applied)

<a id="kind-use_case"></a>

### Use case (`use_case`)

Something an actor does with the product to reach a goal.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`domain`](#kind-domain), [`capability`](#kind-capability)
- **Children:** [`requirement`](#kind-requirement), [`question`](#kind-question)
- **Required fields:** `actor`
- **Obligation:** no
- **ID:** `<P>-<D>-UC<nn>`, such as `TL-LEND-UC01`
- **Links out:** Applies ([`applies`](#relation-applies)), Follows ([`follows`](#relation-follows)), Reacts to ([`reacts_to`](#relation-reacts_to))
- **Links in:** Questions about this ([`about`](#relation-about)), Carried out by flow ([`carries_out`](#relation-carries_out))
- **Checks:** [`use-case-without-requirements`](#check-use-case-without-requirements), [`use-case-outside-capability`](#check-use-case-outside-capability), [`pattern-setting-missing`](#check-pattern-setting-missing), [`pattern-setting-clash`](#check-pattern-setting-clash), [`use-case-without-flow`](#check-use-case-without-flow), [`event-unheard`](#check-event-unheard)

<a id="kind-requirement"></a>

### UC requirement (`requirement`)

One rule a use case must follow, stated with MUST, MUST NOT, SHOULD or MAY. Shown as a UC (use case) requirement, to tell it apart from interaction requirements and pattern rules.

- **Stage:** Define
- **Folder:** [Capabilities](#folder-use-cases)
- **Parents:** [`use_case`](#kind-use_case)
- **Children:** none
- **Required fields:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<use case>-R<nn>`, such as `TL-LEND-UC01-R01`
- **Links out:** none
- **Links in:** Carried out in ([`fulfills`](#relation-fulfills)), Designed by ([`satisfies`](#relation-satisfies)), Proved by ([`proves`](#relation-proves)), Questions about this ([`about`](#relation-about)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`obligation-outside-domain`](#check-obligation-outside-domain)

<a id="kind-pattern"></a>

### Pattern (`pattern`)

Behavior several use cases share, stated once with the settings each use case that follows it fills in. Its settings are a space-separated list of field names.

- **Stage:** Define
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`product`](#kind-product)
- **Children:** [`pattern_rule`](#kind-pattern_rule)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-PAT-<name>`, such as `TL-PAT-LIBRARIAN-ACTION`
- **Links out:** none
- **Links in:** Followed by ([`follows`](#relation-follows)), Questions about this ([`about`](#relation-about))
- **Checks:** [`pattern-setting-missing`](#check-pattern-setting-missing), [`pattern-setting-clash`](#check-pattern-setting-clash), [`bad-pattern-settings`](#check-bad-pattern-settings), [`pattern-rule-setting-unknown`](#check-pattern-rule-setting-unknown), [`pattern-not-followed`](#check-pattern-not-followed)

<a id="kind-pattern_rule"></a>

### Pattern rule (`pattern_rule`)

One rule of a pattern, stated with MUST, MUST NOT, SHOULD or MAY. Every domain that follows the pattern designs and proves it, unless the rule names a setting (in `setting`) that all of that domain's following use cases mark Not applicable.

- **Stage:** Define
- **Folder:** [Shared](#folder-shared)
- **Parents:** [`pattern`](#kind-pattern)
- **Children:** none
- **Required fields:** none
- **Obligation:** proof only
- **ID:** `<pattern>-R<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-R01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about)), Designed by ([`satisfies`](#relation-satisfies)), Proved by ([`proves`](#relation-proves)), Carried out in ([`fulfills`](#relation-fulfills)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unproved`](#check-unproved), [`pattern-rule-setting-unknown`](#check-pattern-rule-setting-unknown)

<a id="kind-flow"></a>

### Flow (`flow`)

An end-to-end path through views and endpoints that carries out one or more use cases.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain), [`capability`](#kind-capability)
- **Children:** [`flow_step`](#kind-flow_step), [`interaction_requirement`](#kind-interaction_requirement)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-<D>-F<nn>`, such as `TL-LEND-F01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses)), Carries out ([`carries_out`](#relation-carries_out))
- **Links in:** Questions about this ([`about`](#relation-about)), Run by ([`runs`](#relation-runs))
- **Checks:** [`use-case-without-flow`](#check-use-case-without-flow), [`flow-step-fulfills-outside-flow`](#check-flow-step-fulfills-outside-flow), [`flow-fulfills-differs-from-steps`](#check-flow-fulfills-differs-from-steps)

<a id="kind-flow_step"></a>

### Flow step (`flow_step`)

One step of a flow, in order: what happens, through which view, endpoint or component, and what the step carries out. An optional `path` names the path through the flow the step is on, such as main or refused; a step with no path is on the main path. Each path's steps are numbered 1, 2, 3 and so on.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`flow`](#kind-flow)
- **Children:** none
- **Required fields:** `order`
- **Obligation:** no
- **ID:** `<flow>-S<nn>`, such as `TL-LEND-F01-S01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`flow-step-order`](#check-flow-step-order), [`flow-step-fulfills-outside-flow`](#check-flow-step-fulfills-outside-flow), [`flow-fulfills-differs-from-steps`](#check-flow-fulfills-differs-from-steps)

<a id="kind-view"></a>

### View (`view`)

A screen or page a person uses.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain)
- **Children:** [`interaction_requirement`](#kind-interaction_requirement)
- **Required fields:** none
- **Obligation:** no
- **ID:** `<P>-<D>-V<nn>`, such as `TL-LEND-V01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills)), Uses ([`uses`](#relation-uses))
- **Links in:** Used by ([`uses`](#relation-uses)), Implemented by ([`implements`](#relation-implements)), Questions about this ([`about`](#relation-about))

<a id="kind-endpoint"></a>

### Endpoint (`endpoint`)

An HTTP endpoint: its method, route, request and responses.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`domain`](#kind-domain)
- **Children:** [`interaction_requirement`](#kind-interaction_requirement)
- **Required fields:** `method`, `route`
- **Obligation:** no
- **ID:** `<P>-<D>-E<nn>`, such as `TL-LEND-E01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills))
- **Links in:** Used by ([`uses`](#relation-uses)), Implemented by ([`implements`](#relation-implements)), Questions about this ([`about`](#relation-about))

<a id="kind-interaction_requirement"></a>

### Interaction requirement (`interaction_requirement`)

One rule a view, endpoint or flow must follow, such as a field's limits or an error's response, stated with MUST, MUST NOT, SHOULD or MAY.

- **Stage:** Design
- **Folder:** [Interaction design](#folder-interaction-design)
- **Parents:** [`view`](#kind-view), [`endpoint`](#kind-endpoint), [`flow`](#kind-flow)
- **Children:** none
- **Required fields:** none
- **Obligation:** yes: designed, built and proved
- **ID:** `<view, endpoint or flow>-R<nn>`, such as `TL-LEND-E03-R01`
- **Links out:** Carries out ([`fulfills`](#relation-fulfills))
- **Links in:** Designed by ([`satisfies`](#relation-satisfies)), Proved by ([`proves`](#relation-proves)), Questions about this ([`about`](#relation-about)), Carried out in ([`fulfills`](#relation-fulfills)), Supported by ([`supports`](#relation-supports))
- **Checks:** [`unsatisfied`](#check-unsatisfied), [`unproved`](#check-unproved), [`obligation-outside-domain`](#check-obligation-outside-domain), [`interaction-requirement-fulfills-nothing`](#check-interaction-requirement-fulfills-nothing)

<a id="kind-layer"></a>

### Layer (`layer`)

An ordered part of a domain's technical specification that groups its components by what they are, such as Models, Services or Web app. It sits in the domain, or in another layer as a sub-layer. Its order is a whole number giving its place among the layers beside it.

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`domain`](#kind-domain), [`layer`](#kind-layer)
- **Children:** [`layer`](#kind-layer), [`component`](#kind-component)
- **Required fields:** `order`
- **Obligation:** no
- **ID:** `<P>-<D>-LAY<nn>`, such as `TL-LEND-LAY01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`layer-order`](#check-layer-order), [`component-outside-layer`](#check-component-outside-layer), [`lone-child`](#check-lone-child)

<a id="kind-component"></a>

### Component (`component`)

A unit of code in the target design, such as a model, service or router. It sits in its domain's layer, or in the domain when the domain has no layers.

- **Stage:** Design
- **Folder:** [Technical specification](#folder-technical-specification)
- **Parents:** [`domain`](#kind-domain), [`layer`](#kind-layer)
- **Children:** [`question`](#kind-question)
- **Required fields:** `component_type`, `file`
- **Obligation:** no
- **ID:** `<P>-<D>-C<nn>`, such as `TL-LEND-C01`
- **Links out:** Satisfies ([`satisfies`](#relation-satisfies)), Implements ([`implements`](#relation-implements)), Depends on ([`depends_on`](#relation-depends_on)), Reacts to ([`reacts_to`](#relation-reacts_to))
- **Links in:** Depended on by ([`depends_on`](#relation-depends_on)), Questions about this ([`about`](#relation-about)), Covered by ([`covers`](#relation-covers)), Used by ([`uses`](#relation-uses))
- **Checks:** [`component-file-missing`](#check-component-file-missing), [`component-outside-layer`](#check-component-outside-layer), [`event-unheard`](#check-event-unheard)

<a id="kind-test"></a>

### Test (`test`)

A test that proves obligations, or supports them without proving them. Its state is automated (the default; it names the file that runs it in run_by), manual, or planned. An optional `key` is text its file contains in place of IDs, and an optional `key_file` names the file that holds the key, when the test runs from a shared class in another file.

- **Stage:** Design
- **Folder:** [Test plan](#folder-test-plan)
- **Parents:** [`domain`](#kind-domain), [`capability`](#kind-capability)
- **Children:** none
- **Required fields:** `test_type`
- **Obligation:** no
- **ID:** `<P>-<D>-T<nn>`, such as `TL-LEND-T01`
- **Links out:** Proves ([`proves`](#relation-proves)), Runs ([`runs`](#relation-runs)), Covers ([`covers`](#relation-covers)), Supports ([`supports`](#relation-supports))
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`test-file-missing`](#check-test-file-missing), [`test-file-missing-id`](#check-test-file-missing-id), [`bad-test-state`](#check-bad-test-state), [`test-run-by-missing`](#check-test-run-by-missing), [`proof-not-in-file`](#check-proof-not-in-file), [`test-type-mismatch`](#check-test-type-mismatch), [`proof-still-owed`](#check-proof-still-owed), [`proof-counts-nowhere`](#check-proof-counts-nowhere), [`manual-test-file-silent`](#check-manual-test-file-silent)

<a id="kind-question"></a>

### Open question (`question`)

Something undecided, with the person who decides it.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** [`product`](#kind-product), [`domain`](#kind-domain), [`aggregate`](#kind-aggregate), [`use_case`](#kind-use_case), [`component`](#kind-component)
- **Children:** none
- **Required fields:** `owner`
- **Obligation:** no
- **ID:** `<P>-<D>-Q<nn> or <P>-Q<nn>`, such as `TL-LEND-Q01`
- **Links out:** About ([`about`](#relation-about))
- **Links in:** Questions about this ([`about`](#relation-about))

<a id="kind-fitness"></a>

### Fitness (`fitness`)

How well the product serves its purpose, as judged by the person it serves on a date: a score from 1 to 5 and the experiences behind it.

- **Stage:** none (structural)
- **Folder:** none
- **Parents:** [`product`](#kind-product)
- **Children:** none
- **Required fields:** `date`, `score`
- **Obligation:** no
- **ID:** `<P>-FIT<nn>`, such as `LA-FIT01`
- **Links out:** none
- **Links in:** Questions about this ([`about`](#relation-about))
- **Checks:** [`bad-fitness-date`](#check-bad-fitness-date), [`bad-fitness-score`](#check-bad-fitness-score)

## Relations

Every relation, from `meta/relations.csv`: which kind may link to which, what the link does, and the plain words it reads as from the source (forward) and from the target (reverse).

<a id="relation-relates_to"></a>

### `relates_to`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`aggregate`](#kind-aggregate) | [`aggregate`](#kind-aggregate) | - | Relates to | Related to by | One aggregate refers to another by ID. |

<a id="relation-applies"></a>

### `applies`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`use_case`](#kind-use_case) | [`domain_rule`](#kind-domain_rule) | - | Applies | Applied by | The use case relies on the domain rule. |

<a id="relation-follows"></a>

### `follows`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`use_case`](#kind-use_case) | [`pattern`](#kind-pattern) | - | Follows | Followed by | The use case follows the pattern and gives a value for each of its settings. |
| [`domain`](#kind-domain) | [`pattern`](#kind-pattern) | - | Follows | Followed by | The whole domain follows the pattern, and so owes each of its rules. |

<a id="relation-fulfills"></a>

### `fulfills`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`flow`](#kind-flow) | [`requirement`](#kind-requirement) | - | Carries out | Carried out in | The flow carries out the requirement. |
| [`view`](#kind-view) | [`requirement`](#kind-requirement) | - | Carries out | Carried out in | The view carries out the requirement. |
| [`endpoint`](#kind-endpoint) | [`requirement`](#kind-requirement) | - | Carries out | Carried out in | The endpoint carries out the requirement. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`requirement`](#kind-requirement) | - | Carries out | Carried out in | The interaction requirement carries out the use case requirement at a view, endpoint or flow. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`domain_rule`](#kind-domain_rule) | - | Carries out | Carried out in | The interaction requirement carries out the domain rule at a view, endpoint or flow. |
| [`flow`](#kind-flow) | [`domain_rule`](#kind-domain_rule) | - | Carries out | Carried out in | The flow carries out the domain rule. |
| [`flow`](#kind-flow) | [`interaction_requirement`](#kind-interaction_requirement) | - | Carries out | Carried out in | The flow carries out the interaction requirement. |
| [`flow_step`](#kind-flow_step) | [`requirement`](#kind-requirement) | - | Carries out | Carried out in | The step carries out the requirement. |
| [`flow_step`](#kind-flow_step) | [`interaction_requirement`](#kind-interaction_requirement) | - | Carries out | Carried out in | The step carries out the interaction requirement. |
| [`flow_step`](#kind-flow_step) | [`domain_rule`](#kind-domain_rule) | - | Carries out | Carried out in | The step carries out the domain rule. |
| [`interaction_requirement`](#kind-interaction_requirement) | [`pattern_rule`](#kind-pattern_rule) | - | Carries out | Carried out in | The interaction requirement carries out the pattern rule at its view, endpoint or flow. |
| [`flow_step`](#kind-flow_step) | [`pattern_rule`](#kind-pattern_rule) | - | Carries out | Carried out in | The step carries out the pattern rule. |

<a id="relation-uses"></a>

### `uses`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`flow`](#kind-flow) | [`view`](#kind-view) | - | Uses | Used by | The flow passes through the view. |
| [`flow`](#kind-flow) | [`endpoint`](#kind-endpoint) | - | Uses | Used by | The flow calls the endpoint. |
| [`view`](#kind-view) | [`endpoint`](#kind-endpoint) | - | Uses | Used by | The view calls the endpoint. |
| [`flow_step`](#kind-flow_step) | [`view`](#kind-view) | - | Uses | Used by | The step happens in the view. |
| [`flow_step`](#kind-flow_step) | [`endpoint`](#kind-endpoint) | - | Uses | Used by | The step calls the endpoint. |
| [`flow_step`](#kind-flow_step) | [`component`](#kind-component) | - | Uses | Used by | The step is carried out by the component. |

<a id="relation-satisfies"></a>

### `satisfies`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`component`](#kind-component) | [`requirement`](#kind-requirement) | design | Satisfies | Designed by | The component designs or implements the requirement. |
| [`component`](#kind-component) | [`domain_rule`](#kind-domain_rule) | design | Satisfies | Designed by | The component enforces the domain rule. |
| [`component`](#kind-component) | [`interaction_requirement`](#kind-interaction_requirement) | design | Satisfies | Designed by | The component designs or implements the interaction requirement. |
| [`component`](#kind-component) | [`pattern_rule`](#kind-pattern_rule) | design | Satisfies | Designed by | The component designs or implements the pattern rule, for the domain it sits in. |

<a id="relation-implements"></a>

### `implements`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`component`](#kind-component) | [`endpoint`](#kind-endpoint) | - | Implements | Implemented by | The component serves the endpoint. |
| [`component`](#kind-component) | [`view`](#kind-view) | - | Implements | Implemented by | The component renders the view. |

<a id="relation-depends_on"></a>

### `depends_on`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`component`](#kind-component) | [`component`](#kind-component) | - | Depends on | Depended on by | The component calls or imports the other. |

<a id="relation-proves"></a>

### `proves`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`test`](#kind-test) | [`requirement`](#kind-requirement) | proof | Proves | Proved by | The test proves the requirement. |
| [`test`](#kind-test) | [`domain_rule`](#kind-domain_rule) | proof | Proves | Proved by | The test proves the domain rule. |
| [`test`](#kind-test) | [`interaction_requirement`](#kind-interaction_requirement) | proof | Proves | Proved by | The test proves the interaction requirement. |
| [`test`](#kind-test) | [`pattern_rule`](#kind-pattern_rule) | proof | Proves | Proved by | The test proves the pattern rule, for the domain it sits in. |

<a id="relation-about"></a>

### `about`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`question`](#kind-question) | any kind | - | About | Questions about this | The open question concerns that record. |

<a id="relation-carries_out"></a>

### `carries_out`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`flow`](#kind-flow) | [`use_case`](#kind-use_case) | - | Carries out | Carried out by flow | The flow carries out the use case. |

<a id="relation-runs"></a>

### `runs`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`test`](#kind-test) | [`flow`](#kind-flow) | - | Runs | Run by | The test runs the flow end to end. |

<a id="relation-covers"></a>

### `covers`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`test`](#kind-test) | [`component`](#kind-component) | - | Covers | Covered by | The test exercises the component. |

<a id="relation-has_one"></a>

### `has_one`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | - | Has one | Part of | The entity holds exactly one of the other entity, as a part of it (one to one). |

<a id="relation-has_many"></a>

### `has_many`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | - | Has many | Part of | The entity holds any number of the other entity, as parts of it (one to many). |

<a id="relation-refers_to"></a>

### `refers_to`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`entity`](#kind-entity) | [`entity`](#kind-entity) | - | Refers to | Referred to by | The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one). |

<a id="relation-raised_by"></a>

### `raised_by`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`domain_event`](#kind-domain_event) | [`entity`](#kind-entity) | - | Raised by | Raises | The event is raised when that entity of its aggregate changes. |

<a id="relation-reacts_to"></a>

### `reacts_to`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`aggregate`](#kind-aggregate) | [`domain_event`](#kind-domain_event) | - | Reacts to | Reacted to by | The aggregate changes in response to the event, which may come from another aggregate or domain. |
| [`use_case`](#kind-use_case) | [`domain_event`](#kind-domain_event) | - | Reacts to | Reacted to by | The use case starts when the event happens. |
| [`component`](#kind-component) | [`domain_event`](#kind-domain_event) | - | Reacts to | Reacted to by | The component handles the event. |

<a id="relation-supports"></a>

### `supports`

| From | To | Role | Forward | Reverse | Meaning |
| --- | --- | --- | --- | --- | --- |
| [`test`](#kind-test) | [`requirement`](#kind-requirement) | - | Supports | Supported by | The test checks a mechanism that backs the use case requirement, such as a lock or a budget, without proving it; it is never counted as proof. |
| [`test`](#kind-test) | [`domain_rule`](#kind-domain_rule) | - | Supports | Supported by | The test checks a mechanism that backs the domain rule, such as a lock or a budget, without proving it; it is never counted as proof. |
| [`test`](#kind-test) | [`interaction_requirement`](#kind-interaction_requirement) | - | Supports | Supported by | The test checks a mechanism that backs the interaction requirement, such as a lock or a budget, without proving it; it is never counted as proof. |
| [`test`](#kind-test) | [`pattern_rule`](#kind-pattern_rule) | - | Supports | Supported by | The test checks a mechanism that backs the pattern rule, such as a lock or a budget, without proving it; it is never counted as proof. |

## Folders

The folders kinds sit in, from `meta/sections.csv`, in stage then order.

<a id="folder-shared"></a>

### Shared (`shared`)

What a product's domains share: patterns and their rules.

- **Stage:** Product level, order 1
- **Kinds:** [`pattern`](#kind-pattern), [`pattern_rule`](#kind-pattern_rule)

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

Flows and their steps, views, endpoints and interaction requirements.

- **Stage:** Design, order 1
- **Kinds:** [`flow`](#kind-flow), [`flow_step`](#kind-flow_step), [`view`](#kind-view), [`endpoint`](#kind-endpoint), [`interaction_requirement`](#kind-interaction_requirement)

<a id="folder-technical-specification"></a>

### Technical specification (`technical-specification`)

The components of the target design, in their layers.

- **Stage:** Design, order 2
- **Kinds:** [`layer`](#kind-layer), [`component`](#kind-component)

<a id="folder-test-plan"></a>

### Test plan (`test-plan`)

The tests that prove the obligations.

- **Stage:** Design, order 3
- **Kinds:** [`test`](#kind-test)

## Checks

Every check, from the header comment of its file: Lathe's checks, the engine's own, then the product's.

<a id="check-duplicate-id"></a>

### `duplicate-id`

**Error** · Lathe's `checks/01-duplicate-id.sql`

Every record ID is unique across the whole workspace.

Links, parents and coverage name records by ID, so two records with one ID make every reference to it
ambiguous. Each record with the repeated ID is reported. Give all but one of them a new ID; IDs are never
reused, so pick the next free number rather than an old one.

<a id="check-bad-id"></a>

### `bad-id`

**Error** · Lathe's `checks/02-bad-id.sql`

Every record has an ID in the form `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`.

An ID is capital letters and digits, starting with a letter, in parts joined by single hyphens, such as
`TL-LEND-UC01`. A record with no ID, or with lower-case letters, spaces or other signs in it, is reported.
Rewrite the ID in that form, following the ID convention for its kind.

<a id="check-unknown-kind"></a>

### `unknown-kind`

**Error** · Lathe's `checks/03-unknown-kind.sql`

Every record's kind is one of the kinds the meta-model defines.

The kinds are Lathe's `meta/kinds.csv` plus any the product adds in its `metaExtensions` folder. A record
with a misspelled or missing kind is reported. Fix the `kind` field, or add the kind to the product's
`kinds.csv` if it is a kind of its own.

<a id="check-missing-title"></a>

### `missing-title`

**Error** · Lathe's `checks/04-missing-title.sql`

Every record has a title.

A title is the short name every page and list shows. For a rule or requirement, it is the rule in a few
words. Add a `title` field to the record's header.

<a id="check-missing-parent"></a>

### `missing-parent`

**Error** · Lathe's `checks/05-missing-parent.sql`

Every record except a product names its parent.

A record belongs to the record named in `parent`, which places it in its product and domain. Add the
`parent` field, naming a record of one of the kind's allowed parent kinds.

<a id="check-unknown-parent"></a>

### `unknown-parent`

**Error** · Lathe's `checks/06-unknown-parent.sql`

A record's parent is a record in the workspace.

A `parent` that names no record leaves the record outside every product and domain. Fix the ID, or add the
missing parent record. A record whose parent does not exist is reported here only, not also by the parent
kind check.

<a id="check-parent-kind-not-allowed"></a>

### `parent-kind-not-allowed`

**Error** · Lathe's `checks/07-parent-kind-not-allowed.sql`

A record's parent is of one of the kinds its kind allows as a parent.

Each kind lists its allowed parent kinds in `parent_kinds` (see the kind's reference). Products are covered
by product-has-parent instead, and an unknown parent is unknown-parent only. When the parent ID is
duplicated (duplicate-id), the record is reported only if no record with that ID could be its parent. Move
the record under a parent of an allowed kind, or widen the kind's `parent_kinds` in the product's
extension.

<a id="check-product-has-parent"></a>

### `product-has-parent`

**Error** · Lathe's `checks/08-product-has-parent.sql` · Kinds: [`product`](#kind-product)

A product is a root record and has no parent.

Every other record sits under a product, so a product itself sits under nothing. Remove the product's
`parent` field.

<a id="check-missing-required-field"></a>

### `missing-required-field`

**Error** · Lathe's `checks/09-missing-required-field.sql`

A record has every field its kind requires, with a non-empty value.

Each kind lists its required fields in `required_fields` (see the kind's reference), such as a use case's
`actor` or a component's `file`. Add the missing field to the record's header with a value.

<a id="check-unknown-relation"></a>

### `unknown-relation`

**Error** · Lathe's `checks/10-unknown-relation.sql`

Every link uses a relation the meta-model names.

The relations are Lathe's `meta/relations.csv` plus any the product adds in its extension. A link under a
misspelled or unknown relation name is reported once for each record and name. Fix the name under `links`,
or add the relation to the product's `relations.csv`.

<a id="check-relation-not-allowed"></a>

### `relation-not-allowed`

**Error** · Lathe's `checks/11-relation-not-allowed.sql`

A known relation is allowed from the source record's kind to the target record's kind.

Each row of `relations.csv` allows one relation from one source kind to one target kind (`*` allows any
target kind). When the target ID is duplicated (duplicate-id), the link is reported only if no record with
that ID could be its target, so one duplicate does not turn every link to it into an error. Link to a
record of an allowed kind, use the relation meant for this pair, or allow the pair in the product's
extension.

<a id="check-dangling-link"></a>

### `dangling-link`

**Error** · Lathe's `checks/12-dangling-link.sql`

Every link points at a record that exists.

A link whose target ID is no record is reported once for each source, relation and target. Fix the ID, or
remove the link if its target was removed on purpose.

<a id="check-test-file-missing"></a>

### `test-file-missing`

**Error or Warning** · Lathe's `checks/13-test-file-missing.sql` · Kinds: [`test`](#kind-test)

A test's `run_by` file, and its `key_file` when it names one, exists.

For an automated or manual test a missing file is an error. A planned test may name the file it will live
in, so for it a missing file is a warning, as for a component whose file does not exist yet. An automated
test with no `run_by` at all is test-run-by-missing. A `key_file` (the file that holds the test's key, when
the test runs from a shared class in another file) must be a file under the product root; one outside it
is always an error. A key file is read only for a test that names its `run_by`. Fix the path (relative to
the repo root), or write the file.

<a id="check-test-file-missing-id"></a>

### `test-file-missing-id`

**Error** · Lathe's `checks/14-test-file-missing-id.sql` · Kinds: [`test`](#kind-test)

An automated test's `run_by` file names the test, so the code can be traced back to it.

The file must name the test's own ID, or else every ID the test proves (each target of a relation whose
role is `proof`); a missing proved ID is proof-not-in-file. This check reports the two cases that leave no
proved ID to name:

  * a test with a `key` whose file does not contain that key text (the ID rules then do not apply);
  * a test that proves no record and whose file does not name its own ID.

A test that proves no record but `supports` one (a check of a mechanism that backs an obligation without
proving it) is not reported: support is never proof, so its file owes no ID. A test with a `key_file` (the
file that holds its key, when it runs from a shared class in another file) is judged by that file instead
of `run_by`; a key file that is missing or outside the root is test-file-missing only. A test with no state
is automated; manual and planned tests are not checked here. Put the test's ID in the test's name in the
file, or fix its `key` or `key_file`.

<a id="check-unsatisfied"></a>

### `unsatisfied`

**Warning** · Lathe's `checks/15-unsatisfied.sql` · Kinds: [`requirement`](#kind-requirement), [`domain_rule`](#kind-domain_rule), [`interaction_requirement`](#kind-interaction_requirement)

An obligation that no design link targets yet.

An obligation is any kind the meta-model marks as one. A proof-only obligation kind (kinds.csv obligation
`proof`) asks for no design, so it is never reported. A pattern rule is owed by each domain that follows
its pattern, itself or through a use case (unless, followed only through use cases, its setting is Not
applicable in every one of them there, as in lathe/src/coverage.ts), and only a component in that domain
designs it there, so it is reported once for each domain that owes it and lacks one. Link a component to
it with `satisfies`, or another design relation.

<a id="check-unproved"></a>

### `unproved`

**Warning** · Lathe's `checks/16-unproved.sql` · Kinds: [`requirement`](#kind-requirement), [`domain_rule`](#kind-domain_rule), [`interaction_requirement`](#kind-interaction_requirement), [`pattern_rule`](#kind-pattern_rule)

An obligation that no automated or manual test proves yet.

A test proves an obligation through a `proof` link such as `proves`. A test with no state is automated; a
planned test is not proof. A pattern rule is owed by each domain that follows its pattern, itself or
through a use case (unless, followed only through use cases, its setting is Not applicable in every one of
them there, as in lathe/src/coverage.ts), and only a test in that domain proves it there, so it is
reported once for each domain that owes it and lacks one. An automated test's proof counts only when its
file backs it, as in coverage: the file names the test's own ID (or its key), or names that target. An
unbacked claim is also a proof-not-in-file error. Write a test that `proves` it, and name the test in its
file.

<a id="check-use-case-without-requirements"></a>

### `use-case-without-requirements`

**Warning** · Lathe's `checks/17-use-case-without-requirements.sql` · Kinds: [`use_case`](#kind-use_case)

A use case with no requirements under it yet.

A use case's requirements are the rules it must follow, so one with none says nothing checkable. A use
case that follows a pattern is left out: its rules come from the pattern's rules, so it may have no
requirements of its own. Add `requirement` records under it, or have it follow the pattern it applies.

<a id="check-component-file-missing"></a>

### `component-file-missing`

**Warning** · Lathe's `checks/18-component-file-missing.sql` · Kinds: [`component`](#kind-component)

A component whose file does not exist yet.

The design may name a file before it is written, so this is work to do, not breakage. Write the file, or
fix the path (relative to the repo root).

<a id="check-meta-duplicate-kind"></a>

### `meta-duplicate-kind`

**Error** · Lathe's `checks/19-meta-duplicate-kind.sql`

Each meta-model folder defines a kind at most once.

A row in a later folder (a product's extension) for a kind already defined widens that kind; it is not a
duplicate. Two rows for one kind in the same `kinds.csv` are reported, naming the file. Merge them into one
row.

<a id="check-meta-unknown-parent-kind"></a>

### `meta-unknown-parent-kind`

**Error** · Lathe's `checks/20-meta-unknown-parent-kind.sql`

Every kind named in a kind's `parent_kinds` is a kind the meta-model defines.

A misspelled parent kind allows no parent at all. Fix the name in `kinds.csv`, or define the kind.

<a id="check-meta-unknown-relation-kind"></a>

### `meta-unknown-relation-kind`

**Error** · Lathe's `checks/21-meta-unknown-relation-kind.sql`

Every source and target kind of a relation rule is a kind the meta-model defines.

The `*` target, meaning any kind, is allowed. A misspelled kind makes the rule allow nothing. Fix the name
in `relations.csv`, or define the kind.

<a id="check-meta-duplicate-relation"></a>

### `meta-duplicate-relation`

**Error** · Lathe's `checks/22-meta-duplicate-relation.sql`

Each meta-model folder lists a relation rule at most once.

A relation rule is a relation, a source kind and a target kind. A row in a later folder (a product's
extension) for a rule already listed restates or rewords that rule; it is not a duplicate. Two rows for one
rule in the same `relations.csv` are reported, naming the file. Merge them into one row.

<a id="check-meta-bad-required-field"></a>

### `meta-bad-required-field`

**Error** · Lathe's `checks/23-meta-bad-required-field.sql`

Each kind's required fields are valid field names.

A field name is lower-case letters, digits and underscores, starting with a letter, and not one of the
fields every record has (`id`, `kind`, `title`, `parent`, `links`). Rename the field in `kinds.csv`.

<a id="check-bad-fitness-date"></a>

### `bad-fitness-date`

**Error** · Lathe's `checks/24-bad-fitness-date.sql` · Kinds: [`fitness`](#kind-fitness)

A fitness record's date is a real calendar date written YYYY-MM-DD.

A missing date is missing-required-field. Write the date of the judgment in that form, such as
`2026-03-02`.

<a id="check-bad-fitness-score"></a>

### `bad-fitness-score`

**Error** · Lathe's `checks/25-bad-fitness-score.sql` · Kinds: [`fitness`](#kind-fitness)

A fitness record's score is a whole number from 1 to 5.

1 means the product does not serve its purpose, 5 that it serves it fully. A missing score is
missing-required-field. Write the score as `score: 4` or `score: "4"`.

<a id="check-bad-test-state"></a>

### `bad-test-state`

**Error** · Lathe's `checks/26-bad-test-state.sql` · Kinds: [`test`](#kind-test)

A test's state, when given, is automated, manual or planned.

The state is read in any letter case, as coverage reads it. Without a state a test is automated. Fix the
value, or remove the field for an automated test.

<a id="check-test-run-by-missing"></a>

### `test-run-by-missing`

**Error** · Lathe's `checks/27-test-run-by-missing.sql` · Kinds: [`test`](#kind-test)

An automated test names the file that runs it in `run_by`.

A test with no state, or state automated, is automated. Manual and planned tests need no `run_by`. Add the
path of the test file, relative to the repo root, or give the test the state it really has.

<a id="check-capability-order"></a>

### `capability-order`

**Error** · Lathe's `checks/28-capability-order.sql` · Kinds: [`capability`](#kind-capability)

A capability's order is a whole number that no other capability in its domain has.

Orders are compared as numbers, so 1 and 01 clash. A missing order is missing-required-field. Give each
capability in the domain its own whole-number `order`.

<a id="check-use-case-outside-capability"></a>

### `use-case-outside-capability`

**Warning** · Lathe's `checks/29-use-case-outside-capability.sql` · Kinds: [`use_case`](#kind-use_case), [`capability`](#kind-capability)

Once a domain has capabilities, each of its use cases sits in one of them.

A use case left directly under the domain is missing from the domain's use case index. Make one of the
domain's capabilities its `parent`; its ID does not change. A domain with no capabilities is not reported.

<a id="check-pattern-setting-missing"></a>

### `pattern-setting-missing`

**Error** · Lathe's `checks/30-pattern-setting-missing.sql` · Kinds: [`use_case`](#kind-use_case), [`pattern`](#kind-pattern)

A use case that follows a pattern gives each of the pattern's settings.

Each setting is a header field named exactly as the pattern lists it: a value, or "Not applicable:" (any
letter case) and a reason. Setting names that are not valid field names are reported by
bad-pattern-settings instead. Only a pattern with settings asks for them: a pattern with no `settings`
field, or an empty one, asks nothing of the use cases that follow it. A domain that follows a pattern
gives no settings. Add the missing field to the use case, or its reason for Not applicable.

<a id="check-pattern-setting-clash"></a>

### `pattern-setting-clash`

**Warning** · Lathe's `checks/31-pattern-setting-clash.sql` · Kinds: [`use_case`](#kind-use_case), [`pattern`](#kind-pattern)

A use case follows two patterns that share a setting name.

The use case has one field for both settings, so the two cannot be given different values. Rename the
setting in one of the patterns, and its field in the use cases that follow it.

<a id="check-bad-pattern-settings"></a>

### `bad-pattern-settings`

**Error** · Lathe's `checks/32-bad-pattern-settings.sql` · Kinds: [`pattern`](#kind-pattern)

A pattern's settings are field names a use case can carry.

A field name is lower-case letters, digits and underscores, starting with a letter, and not one of the
fields every record has (`id`, `kind`, `title`, `parent`, `links`). A missing settings field is
missing-required-field. Rename the setting in the pattern's `settings` list.

<a id="check-pattern-rule-setting-unknown"></a>

### `pattern-rule-setting-unknown`

**Error** · Lathe's `checks/33-pattern-rule-setting-unknown.sql` · Kinds: [`pattern_rule`](#kind-pattern_rule), [`pattern`](#kind-pattern)

A pattern rule's `setting` is one of the settings its pattern lists.

A pattern rule that depends on a setting names it in `setting`. A rule whose parent is not a pattern is
reported by the parent checks instead. Fix the name, add the setting to the pattern, or remove the field
if the rule depends on no setting.

<a id="check-pattern-not-followed"></a>

### `pattern-not-followed`

**Warning** · Lathe's `checks/34-pattern-not-followed.sql` · Kinds: [`pattern`](#kind-pattern)

A pattern that no use case and no domain follows.

No domain owes its rules, so they count in no domain's coverage. Link the use cases or domains that apply
it with `follows`, or remove the pattern if nothing needs it.

<a id="check-obligation-outside-domain"></a>

### `obligation-outside-domain`

**Warning** · Lathe's `checks/35-obligation-outside-domain.sql` · Kinds: [`requirement`](#kind-requirement), [`domain_rule`](#kind-domain_rule), [`interaction_requirement`](#kind-interaction_requirement)

An obligation that sits in no domain.

It counts in no domain's coverage, so it is reported rather than silently dropped. A pattern rule under a
pattern is the exception: each domain that follows the pattern owes it (pattern-not-followed reports a
pattern nobody follows). Move the record under a domain, or fix its parent chain.

<a id="check-proof-not-in-file"></a>

### `proof-not-in-file`

**Error** · Lathe's `checks/40-proof-not-in-file.sql` · Kinds: [`test`](#kind-test)

An automated test's file names every ID the test proves, unless it names the test's own ID.

Each target of a relation whose role is `proof` must appear in the file, as a whole ID, when the file does
not name the test's own ID. Each proved ID the file leaves out is one error. A test whose file names its
own ID vouches for all its claims; a test with a `key` is checked by test-file-missing-id instead. A test
with a `key_file` is judged by that file instead of `run_by`; a key file that is missing or outside the
root is test-file-missing only. A `supports` link is not a proof claim, so its target need not appear.
Manual and planned tests are not checked here. Name the ID in the test's name in the file, name the test's
own ID there, or remove the claim.

<a id="check-unknown-id-in-prose"></a>

### `unknown-id-in-prose`

**Warning** · Lathe's `checks/41-unknown-id-in-prose.sql`

A record's body cites an ID that no record has.

A citation is an ID-shaped token with one of the workspace's known prefixes (FORMAT.md section 12). Code
spans and fenced code blocks are not read. Fix the wording, or put the ID in code if it is only an
example.

<a id="check-rule-not-applied"></a>

### `rule-not-applied`

**Warning** · Lathe's `checks/42-rule-not-applied.sql` · Kinds: [`domain_rule`](#kind-domain_rule)

A domain rule that no use case applies.

A rule that nothing applies is either missing from a use case's `applies` links or no longer needed. Link
the use cases that rely on it with `applies`, or remove the rule.

<a id="check-use-case-without-flow"></a>

### `use-case-without-flow`

**Warning** · Lathe's `checks/43-use-case-without-flow.sql` · Kinds: [`use_case`](#kind-use_case), [`flow`](#kind-flow)

Once a domain has flows, each of its use cases is carried out by one.

A flow names the use cases it carries out with `carries_out`. A domain with no flows is not reported: its
interaction design has not started. Add the use case to a flow's `carries_out`, or write a flow for it.

<a id="check-interaction-requirement-fulfills-nothing"></a>

### `interaction-requirement-fulfills-nothing`

**Warning** · Lathe's `checks/44-interaction-requirement-fulfills-nothing.sql` · Kinds: [`interaction_requirement`](#kind-interaction_requirement)

An interaction requirement names what it carries out.

An interaction requirement carries out a use case's requirement, a domain rule or a pattern rule at a
view, endpoint or flow, so it links what it carries out with `fulfills`. Add the `fulfills` link.

<a id="check-test-type-mismatch"></a>

### `test-type-mismatch`

**Warning** · Lathe's `checks/45-test-type-mismatch.sql` · Kinds: [`test`](#kind-test)

A test's `test_type` does not suit what it proves.

Kept conservative: only a test of type domain_rule that proves requirements and no domain rule, or a test
of type acceptance that proves domain rules and no requirement, is reported. A unit test may prove either,
so it is not reported, nor is any other type, nor a test that proves both. Change the type, or what the
test proves.

<a id="check-flow-step-order"></a>

### `flow-step-order`

**Error** · Lathe's `checks/50-flow-step-order.sql` · Kinds: [`flow_step`](#kind-flow_step)

A flow step's order is a whole number that no other step on its path of the flow has, and each path's steps are numbered without gaps.

Steps are read in `order` (FORMAT.md section 14), within their `path`: a short name such as main or
refused, compared trimmed and in any letter case. A step with no path is on the main path. Orders are
compared as numbers, so 1 and 01 clash, and the steps of each path of a flow are numbered 1, 2, 3 and so
on. A path whose orders skip a number is reported once, on the first step after the gap, and only when
each of its orders is a whole number that no other step of the path has, so one mistake gives one error.
A missing order is missing-required-field. Give each step of the path its own whole-number `order`, and
close the gap.

<a id="check-flow-step-fulfills-outside-flow"></a>

### `flow-step-fulfills-outside-flow`

**Warning** · Lathe's `checks/51-flow-step-fulfills-outside-flow.sql` · Kinds: [`flow_step`](#kind-flow_step), [`flow`](#kind-flow)

A flow step fulfills something its flow does not carry out.

A step carries out part of its flow, so what it fulfills belongs to a use case the flow carries out. For a
step under flow F, a `fulfills` target is inside F when it is one of:

  1. a requirement whose parent is a use case F carries_out;
  2. a domain rule that a use case F carries_out applies;
  3. a pattern rule of a pattern that a use case F carries_out follows, or that F's domain follows;
  4. an interaction requirement that fulfills a record of 1, 2 or 3, or that sits under F itself.

Anything else is reported. Kept conservative: a step whose flow carries out no use case, and a target that
does not exist or is of another kind, are left to other checks. Add the use case to the flow's
`carries_out`, or move the link to a step of the flow that carries it out.

<a id="check-flow-fulfills-differs-from-steps"></a>

### `flow-fulfills-differs-from-steps`

**Warning** · Lathe's `checks/52-flow-fulfills-differs-from-steps.sql` · Kinds: [`flow`](#kind-flow), [`flow_step`](#kind-flow_step)

A flow with steps fulfills something none of its steps fulfills.

Once a flow has steps, what the flow fulfills is the union of what its steps fulfill, so each `fulfills`
link belongs on the step that does it. A flow with steps may leave its own `fulfills` out: its steps' links
are enough. Move the link onto the step that carries it out.

<a id="check-proof-still-owed"></a>

### `proof-still-owed`

**Warning** · Lathe's `checks/53-proof-still-owed.sql` · Kinds: [`test`](#kind-test)

An obligation that is already proved, but that a planned test is also meant to prove.

Coverage counts these in `planned_any` but not in `planned`; this check names each one, with the planned
test that still owes its proof, so the list behind `planned_any` is never only a count. An obligation not
yet proved whose test is only planned is reported by unproved instead.

Proof is judged as in lathe/src/coverage.ts: an obligation in a domain is owed by that domain and any test
may prove it; a pattern rule is owed by each domain that follows its pattern, itself or through one of its
use cases (unless the domain follows only through use cases that all mark the rule's setting Not
applicable), and only tests in that domain prove it there or owe it there. An automated test's proof counts
only when its file backs it. Write the planned test, or drop its claim if the proof it owes is already
made.

<a id="check-proof-counts-nowhere"></a>

### `proof-counts-nowhere`

**Warning** · Lathe's `checks/54-proof-counts-nowhere.sql` · Kinds: [`test`](#kind-test)

A test whose proofs count in no domain's coverage.

A test's proof of a target counts, as in lathe/src/coverage.ts, when the target is an obligation in a
domain, or a pattern rule owed by the domain the test sits in (a domain owes a pattern rule when it follows
the pattern itself, or when one of its use cases does, unless every following use case there marks the
rule's setting Not applicable). A test is reported when it has at least one `proof` link to a record that
exists and none of its proofs counts; the message says why for each target. A target that does not exist
is only a dangling-link. The test's state does not matter: a planned test that will prove nothing counted
is reported too. Point the test at an obligation that counts, or move it into the domain that owes the
rule.

<a id="check-manual-test-file-silent"></a>

### `manual-test-file-silent`

**Warning** · Lathe's `checks/55-manual-test-file-silent.sql` · Kinds: [`test`](#kind-test)

A manual test whose `run_by` file exists but never mentions it.

Nothing ties the file to the test: it names neither the test's ID, nor any ID the test proves (each target
of a relation whose role is `proof`), nor the test's `key` when it has one. Manual tests are not held to
the automated rules (test-file-missing-id, proof-not-in-file), so a silent file is a warning: the steps a
person follows should say which test they carry out. A test with a `key_file` is judged by that file
instead. A missing file is test-file-missing instead. Name the test in the file, or point `run_by` at the
file that carries it out.

<a id="check-unknown-section"></a>

### `unknown-section`

**Error** · Lathe's `checks/60-unknown-section.sql`

Every section a kind names in `kinds.csv` is a folder that `sections.csv` lists.

A kind in an unknown folder is shown in no folder of the app (FORMAT.md section 15). Fix the kind's
`section`, or add the folder to the product's `sections.csv`.

<a id="check-section-stage-mismatch"></a>

### `section-stage-mismatch`

**Error** · Lathe's `checks/61-section-stage-mismatch.sql`

A kind's section belongs to the kind's own stage.

A Define kind sits in a Define folder and a Design kind in a Design folder (FORMAT.md section 15). A
product-level section, listed with no stage (such as shared), may hold a kind of any stage. Change the
kind's `section` or `stage`, or the folder's stage.

<a id="check-layer-order"></a>

### `layer-order`

**Error** · Lathe's `checks/62-layer-order.sql` · Kinds: [`layer`](#kind-layer)

A layer's order is a whole number that no other layer beside it has.

This works as for capabilities (28-capability-order.sql). Layers beside each other share a parent: the
domain, or the layer that holds them as sub-layers. Layers in different domains, and sub-layers of
different layers, may share an order. A missing order is missing-required-field. Orders are compared as
numbers, so 1 and 01 clash. Give each layer beside the others its own whole-number `order`.

<a id="check-component-outside-layer"></a>

### `component-outside-layer`

**Warning** · Lathe's `checks/63-component-outside-layer.sql` · Kinds: [`component`](#kind-component), [`layer`](#kind-layer)

Once a domain has layers, each of its components sits in one of them.

This works as use cases sit in capabilities (29-use-case-outside-capability.sql). A domain with no layers
may hold its components itself. Make one of the domain's layers the component's `parent`; its ID does not
change.

<a id="check-too-many-children"></a>

### `too-many-children`

**Warning** · Lathe's `checks/64-too-many-children.sql`

A record with more children of one kind than the product's `structure.maxChildren` setting.

The setting is read from `lathe.config.json` (default 15) through the settings table. A parent with that
many children of one kind is missing a level between them, such as a capability, a layer or another
aggregate. Children are counted per kind. Tests are exempt: the app groups them by what they prove
(FORMAT.md section 15), so they are never shown as one list. A child whose parent does not exist is only
unknown-parent. Add a level and move the children into it.

<a id="check-lone-child"></a>

### `lone-child`

**Warning** · Lathe's `checks/65-lone-child.sql` · Kinds: [`capability`](#kind-capability), [`layer`](#kind-layer)

A capability or a layer with exactly one child, of any kind.

A level that holds one record groups nothing. Only its own children are counted, not theirs, and one with
no children is not reported. Merge it into a neighbor, or give it more.

<a id="check-entity-role"></a>

### `entity-role`

**Error** · Lathe's `checks/66-entity-role.sql` · Kinds: [`entity`](#kind-entity)

An entity's role is root or child.

`root` is the aggregate's root record and `child` one of its parts (FORMAT.md section 17), in any letter
case. A missing or empty role is missing-required-field only. Fix the `role` value.

<a id="check-aggregate-root"></a>

### `aggregate-root`

**Error** · Lathe's `checks/67-aggregate-root.sql` · Kinds: [`aggregate`](#kind-aggregate), [`entity`](#kind-entity)

An aggregate that holds entities has exactly one root.

The root is the record the aggregate is named for, through which its other entities are reached (FORMAT.md
section 17). An aggregate with no entities is not reported. Give exactly one of its entities `role: root`.

<a id="check-entity-fields"></a>

### `entity-fields`

**Error** · Lathe's `checks/68-entity-fields.sql` · Kinds: [`entity`](#kind-entity), [`domain_event`](#kind-domain_event)

Each entity or event lists its fields in a Fields table.

An entity's table lists the fields it keeps and a domain event's the fields it carries. The table sits under
a `## Fields` heading (FORMAT.md sections 17 and 18), with the columns Field, Meaning, Kind of value and
Example, in any letter case, one row per field and each field name once. The Meaning column may also be
called Business meaning, as S2 calls it. The engine reads the table into entity_tables and,
when its columns are right, its rows into entity_fields. Field names are compared trimmed, without code span
backticks, and in any letter case. A table with the wrong columns is reported for that alone. Add the
heading and table, fix its columns, or merge the repeated field.

<a id="check-has-crosses-aggregate"></a>

### `has-crosses-aggregate`

**Error** · Lathe's `checks/69-has-crosses-aggregate.sql` · Kinds: [`entity`](#kind-entity)

A `has_one` or `has_many` link stays inside its aggregate.

These relations link an entity to its parts, and parts belong to their aggregate (FORMAT.md section 17),
so both ends sit in the same aggregate. Only `refers_to` may cross aggregates and domains. A link to a
record that does not exist, or that is not an entity, is reported by dangling-link or relation-not-allowed
instead. When the target ID is duplicated, the link is reported only if no entity with that ID shares the
source's aggregate. Use `refers_to`, or move the part into the aggregate.

<a id="check-entity-unreferenced"></a>

### `entity-unreferenced`

**Warning** · Lathe's `checks/70-entity-unreferenced.sql` · Kinds: [`entity`](#kind-entity)

A child entity that its aggregate's root does not reach.

Each child entity is a part of its aggregate's root (FORMAT.md section 17), so a `has_one` or `has_many`
reaches it from the root, directly or through other children of the same aggregate. Links that cross
aggregates (has-crosses-aggregate) and `refers_to` links do not count. An aggregate with no root, or more
than one, is aggregate-root only, so its children are not reported. Link the child from the root or from
another child with `has_one` or `has_many`.

<a id="check-undocumented"></a>

### `undocumented`

**Error** · Lathe's `checks/71-undocumented.sql`

Every kind, relation and check says what it is, so the format reference documents all of them.

The reference (`lathe format`, lathe/REFERENCE.md) is generated from the meta-model and the check files, so
an empty description or header leaves a hole in it. Reported are a kind with an empty description in
`kinds.csv`, a relation rule with an empty description in `relations.csv`, and a check file, Lathe's or the
product's, whose header comment lacks a summary sentence, an explanation or a severity line. A check's
header is one summary sentence, a blank comment line, the explanation ending with how to fix what it
reports, a blank comment line, then `-- severity: error` (or `warning`, or `error, warning`) and an optional
`-- kinds: ...` line. Write what is missing.

<a id="check-relation-unlabeled"></a>

### `relation-unlabeled`

**Error** · Lathe's `checks/72-relation-unlabeled.sql`

Every relation rule says in plain words what its link means, read from either end.

Each row of `relations.csv`, Lathe's or an extension's, carries a `forward_label`, the link read from the
source ("Satisfies"), and a `reverse_label`, the link read from the target ("Designed by"). Every place
that names a link shows these words, never the relation's code: a record's Traceability section and its
facts in the wiki, the inspector's Links out and Links in, the graph's edge labels, legend and connections,
the Model view's line titles, and the format reference. An extension that restates a
rule may leave them empty to keep the earlier labels, so the rule is reported only when, after every
extension is merged, a label is still empty. Write the missing label, in sentence case.

<a id="check-event-unheard"></a>

### `event-unheard`

**Warning** · Lathe's `checks/73-event-unheard.sql` · Kinds: [`domain_event`](#kind-domain_event), [`aggregate`](#kind-aggregate), [`use_case`](#kind-use_case), [`component`](#kind-component)

A domain event that nothing reacts to.

An event is worth naming when something changes because it happened (FORMAT.md section 18): an aggregate,
which may sit in another aggregate or domain, a use case that starts, or a component that handles it, each
linking to the event with `reacts_to`. An event kept only for the record can be fine, so this is a
warning. A `reacts_to` link from any record counts here; one from a kind the meta-model does not allow is
relation-not-allowed. Add `reacts_to` to what changes, starts or runs when the event happens, or leave the
event unheard on purpose.

<a id="check-event-tense"></a>

### `event-tense`

**Warning** · Lathe's `checks/74-event-tense.sql` · Kinds: [`domain_event`](#kind-domain_event)

A domain event's title reads as something that happened, in the past tense.

An event is named for what happened, such as Loan opened or Payment sent (FORMAT.md section 18). The
check is a heuristic over the title's words, in any letter case and split at anything but a letter: the
title passes when its last word, or any word after its first (the word after a one-word subject, as in Loan
became overdue), is a past form. A past form is a word of four or more letters ending in "-ed", other than
the few such words that are not verbs in the past (need, seed, feed, speed, breed, bleed, embed, proceed,
exceed, succeed, hundred, naked, sacred, wicked), or one of the irregular past forms listed below. An empty
title is missing-title only. The heuristic can miss a past form it does not know, so this is a warning.
Name the event in the past tense, as what happened (Tool returned, not Return tool), or add the word to
the list here if it is a past form the check does not know.

Irregular past forms: arose, arisen, ate, eaten, awoke, awoken, became, begun, began, bent, bound, bit,
bitten, blew, blown, broke, broken, bred, brought, built, burnt, bought, caught, chose, chosen, came, cost,
crept, cut, dealt, dug, did, done, drew, drawn, dreamt, drank, drunk, drove, driven, fell, fallen, fed,
felt, fought, found, fled, flew, flown, forbade, forbidden, forgot, forgotten, forgave, forgiven, froze,
frozen, got, gotten, gave, given, went, gone, grew, grown, hung, had, heard, hid, hidden, hit, held, hurt,
kept, knew, known, laid, led, leant, learnt, left, lent, let, lit, lost, made, meant, met, mistook,
mistaken, overdone, overran, overridden, overrode, overtaken, overtook, paid, put, quit, read, rebuilt,
redone, remade, reran, rerun, reset, resent, resold, retook, retaken, rewound, rewrote, rewritten, rode,
ridden, rang, rung, rose, risen, ran, run, said, saw, seen, sought, sold, sent, set, shook, shaken, shone,
shot, showed, shown, shut, sang, sung, sank, sunk, sat, slept, slid, spoke, spoken, sped, spent, spun,
split, spread, sprang, sprung, stood, stole, stolen, stuck, struck, swore, sworn, swept, swam, swum,
swung, took, taken, taught, tore, torn, told, thought, threw, thrown, understood, undid, undone, upheld,
upset, withdrew, withdrawn, withheld, woke, woken, wore, worn, won, wound, wrote, written.

<a id="check-raised-by-outside-aggregate"></a>

### `raised-by-outside-aggregate`

**Error** · Lathe's `checks/75-raised-by-outside-aggregate.sql` · Kinds: [`domain_event`](#kind-domain_event), [`entity`](#kind-entity)

A domain event's `raised_by` names an entity of the event's own aggregate.

An event is raised by its aggregate (FORMAT.md section 18), so the entity whose change raises it is one of
that aggregate's entities. What another aggregate does about the event is said by its `reacts_to`. An
event with no `raised_by` is not reported. A link to a record that does not exist, or that is not an
entity, is reported by dangling-link or relation-not-allowed instead. When the target ID is duplicated, the
link is reported only if no entity with that ID shares the event's aggregate. Point `raised_by` at an
entity of the event's aggregate, or move the event under the aggregate that raises it.

<a id="check-parse-error"></a>

### `parse-error`

**Error** · the engine, `src/parse.ts`

Every record file can be read: a YAML header between `---` lines, then a Markdown body.

A file under the specs folder whose header is missing, is not valid YAML, or is not a map of fields is reported with the reason, and loading carries on without it. Fix the header, or rename the file to README.md if it is not a record.

<a id="check-parent-cycle"></a>

### `parent-cycle`

**Error** · the engine, `src/index.ts`

A record's parent chain never loops back to the record itself.

Each record on the loop is reported, with the chain. A record on a loop sits in no product or domain. Fix the `parent` of one record on the loop.

<a id="check-product-check-name-clash"></a>

### `product-check-name-clash`

**Error** · the engine, `src/index.ts`

A product check is not named like one of Lathe's checks.

A product check whose name (its file name without the number and .sql) equals one of Lathe's checks, or a problem the engine reports itself, is not run, so the two never mix in a report. Rename the file.

<a id="check-product-checks-missing"></a>

### `product-checks-missing`

**Error** · the engine, `src/index.ts`

The checks folder that lathe.config.json names exists.

When it does not, none of the product's checks run. Fix the `checks` path in lathe.config.json, or create the folder.
