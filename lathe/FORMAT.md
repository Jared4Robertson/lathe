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

Nothing outlives its purpose: a component that satisfies no obligation is a `component-satisfies-nothing` warning, and a test that proves and supports nothing is a `test-proves-nothing` warning. There are no waivers; shared infrastructure links the obligations it makes possible.

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

A record's body may cite other records by ID, such as "the loan follows TL-LEND-DR05", so that a renamed or removed record does not leave a stale reference. A citation is a whole ID-shaped token that is a record's ID or starts with a known prefix (every product and domain ID, and `idPrefixes` in `lathe.config.json`). A bare product or domain ID counts only as a code span holding just that ID, and other code is not read. The cited IDs that exist in the record's own product, or in no product, are the record's **mentions**; another product's ID in prose is plain text, because products are separate spaces. Mentions are not links: they count for nothing. Links stay inside their product too: a link from one product's record to another product's is an error (`link-crosses-product`).

## 13. A product's own checks

A product keeps its house rules as checks of its own: `lathe.config.json` names a folder in `checks`, and every `*.sql` file in it runs after Lathe's, over the same tables, with the same row contract and the same header. A product check named like one of Lathe's is not run. Its checks appear in the product's reference with Lathe's.

## 14. Flow steps

A flow can be written as `flow_step` records under it, in `order`: each says what happens, `uses` the view, endpoint or component it goes through, and `fulfills` what it carries out. A flow with more than one path, such as an API path or a refused path beside the main one, names each step's `path`; a step with no path is on the main path. The steps of each path are numbered 1, 2, 3 and so on. Once a flow has steps, what it fulfills is what its steps fulfill.

## 15. Folders

A domain's specs are laid out in folders by stage: in Define, the domain model and use cases; in Design, interaction design (flows, views, APIs with their endpoints, and integrations), technical specification (components in their layers, and technical flows) and the test plan; and at product level what domains share. `meta/sections.csv` names these folders and each kind's `section` says which one it sits in, so the app reads the same way whatever folders the files are in. The app groups the test plan by what each test proves: acceptance, domain rule, pattern, interaction and engineering tests.

## 16. Layers

A domain's components are grouped into **layers**, ordered parts of its technical specification such as Models, Services or Web app, as its use cases are grouped into capabilities. A layer may hold sub-layers, each a layer under it with its own order among them. A component in a layer, at any depth, still belongs to the layer's domain everywhere a domain matters. Layers are records, so each product names its own.

## 17. Entities and the ERD

An aggregate is drawn as an ERD of the records it keeps. Each is an `entity` under the aggregate: one `root`, the record the aggregate is named for, and any number of `child` parts. Its body lists its fields in a table under a `## Fields` heading, with the columns Field, Meaning, Kind of value and Example. A domain rule about one entity may sit under that entity rather than the aggregate, and still belongs to the aggregate and its domain. A domain rule that holds across aggregates, such as two records saved together or a lifecycle rule for every record in the domain, sits under the domain and names with `involves` the two or more aggregates of that domain it ties together; a rule across domains is a domain event's job instead (section 18). `domain-rule-involves` warns of a rule under a domain that involves fewer than two aggregates or one of another domain, and of a rule under an aggregate or entity that uses `involves`. `has_one` and `has_many` link an entity to its parts inside the aggregate; `refers_to` may cross aggregates and domains. The app draws a domain's ERD at aggregate level and each aggregate's ERD with its entities.

## 18. Domain events

A `domain_event` is an unchangeable record that something happened in the domain, named in the past tense (Loan opened, Tool returned). It sits under the aggregate that raises it, and `raised_by` may name the entity of that aggregate whose change raises it; an event raised by time passing, or in an aggregate with no entities, has none. Its body says in a sentence what happened, then lists what the event carries in a `## Fields` table with the same columns as an entity's. What happens next is said by the records that react: an aggregate that changes, a use case that starts or a component that handles the event links to it with `reacts_to`, from any aggregate or domain. An event that nothing reacts to is reported as a warning, since that can be fine but is often a missing link.

## 19. Domains

A domain is a vertical slice of the product: one business capability with its own language, such as Lending or Billing. It owns everything about that capability. Its Define stage holds its domain model (aggregates, entities, events and rules) and its use cases; its Design stage holds its flows, views, endpoints, components and tests. Technology is a layer inside a domain's Design stage, such as Web app, Engine or Desktop, never a domain of its own, so each capability is specified, built and proved in one place. What every domain shares, such as the app shell, sign-in or the server, goes in a platform domain or a pattern, not in a domain named for a technology.

A capability is something a person using the product would name, with its own terms and rules, that would still exist if the product were rebuilt on other technology. A layer is how some capability is delivered.

- **Good:** a library's domains are Membership, Catalog and Lending. Lending holds the loan, its rules and use cases, the screens and endpoints for borrowing and returning, the components in its Web app and Server layers, and the tests that prove them.
- **Bad:** the same library split into Frontend, Backend and Database. Borrowing a tool is then designed in three domains, its rules sit apart from the screens that enforce them, and no domain can say whether borrowing is done.

A domain whose title or code names a technology layer or delivery channel is a `domain-named-for-technology` warning.

## 20. APIs and integrations

A domain's endpoints are grouped by resource into **APIs**: an `api` under the domain holds the `endpoint` records for one resource, such as Loans, and the `interaction_requirement`s that hold for every endpoint in it, such as how it pages or what an unknown ID answers. Its body may hold a `## Shapes` table of the request and response shapes its endpoints share. An endpoint may still sit directly in the domain. An **integration** is an outside system the domain exchanges with, such as a payment provider: an `integration` under the domain, with an optional `system` field naming the system, holds one interaction requirement per exchange. An interaction requirement may also sit directly under the domain, for a rule shared across the domain's interaction design.

## 21. Technical flows

A flow says what a person sees; a **technical flow** says how the system carries it out. A `design_flow`, in the domain or one of its layers, `deepens` the flow it carries out, and its steps are `design_step` records under it, ordered, with an optional `path`, as a flow's steps are (section 14). Each step `uses` the component that does it and `satisfies` the obligations it designs; a step's `satisfies` counts as design, as a component's does, but only a component whose file exists counts as built. A step may say which `transaction` it runs in, what it `locks` and how many `statements` it runs. Failure, limits and signals stay as tables in the technical flow's body. A technical flow that deepens no flow is a `design-flow-deepens-nothing` warning.
