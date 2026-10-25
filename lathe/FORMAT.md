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

Every record has an `id` (unique, matching `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`, never reused or renumbered), a `kind`, a `title`, and a `parent` (except a product) of a kind its kind allows. Its kind may require more plain fields, such as `actor`; any other plain field is kept. `links` maps a relation name to target IDs, each allowed by the meta-model for the two kinds. The body is Markdown; rules and requirements state their rule with MUST, MUST NOT, SHOULD or MAY. A product may carry an `icon` and a `color` for the app's space rail.

## 3. ID convention

An ID is the product prefix, the domain code, then a kind code and number, such as `TL-LEND-UC01`; a record that belongs to another takes its ID and adds a part, such as the requirement `TL-LEND-UC01-R01`. The engine checks only the format and uniqueness; the convention keeps IDs readable. Each kind's pattern is in `meta/ids.csv` and in the reference.

## 4. Code traceability

A `test` has a `state`: `automated` (the default), `manual` or `planned`. An automated test names the file that runs it in `run_by`, and that file names the test's own ID, or else every ID it proves, as whole IDs; a `key` field gives other text the file must contain instead. A manual test describes its procedure in its body. A planned test shows what is meant to prove an obligation, but is not proof. A `component` names its code in `file`, which may not exist yet.

## 5. Checks

Each check is one SQL file in `lathe/checks/`: a `SELECT` over the loaded tables that returns rows of `(severity, check, record, message)`. Its name is its file name without the number and `.sql`. An **error** means the workspace is broken, and `lathe check` exits non-zero; a **warning** is work still to do, such as an obligation not yet proved, two stages that do not join up yet, or a level of the spec that is the wrong size (`structure.maxChildren` in `lathe.config.json`, default 15). One mistake gives one error.

A check documents itself in its header comment: one summary sentence, a blank comment line, the explanation ending with how to fix what it reports, a blank comment line, then `-- severity: error` (or `warning`, or `error, warning`) and an optional `-- kinds:` line naming the kinds it concerns. The reference is built from these headers, and `undocumented` reports a check, kind or relation that lacks its text.

## 6. Coverage

A kind's `obligation` says what it asks: `yes`, an obligation that must be designed, built and proved; `proof`, one that needs proof only; anything else, none. A relation's `role` says what a link does: `design` (a component `satisfies` it) or `proof` (a test `proves` it). Each obligation is counted in the domain that owes it, as **designed**, **built** (designed by a component whose file exists), **proved** (by an automated or manual test) and **planned**, with its gaps.

## 7. Fitness

A `fitness` record is the judgment of the person a product serves: on a `date`, a `score` from 1 (does not serve its purpose) to 5 (serves it fully), and in the body the experiences behind it. Lathe never writes these itself. What it can count (coverage, open questions, checks) is evidence for that judgment, never the score.

## 8. What records do not carry

Records carry no status, approval or decision history: a record in the specs is in force, uncertainty is an open `question`, and git keeps the history. A decided question is removed and its answer written into the records it affects.

## 9. Extending the meta-model

A product adds to the meta-model with a `metaExtensions` folder holding a `kinds.csv`, `relations.csv`, `sections.csv` and/or `ids.csv` with the same columns. A new row is added as it is. A row for a kind, folder or relation rule that already exists changes it: a kind's `parent_kinds` and `required_fields` are widened, and any other non-empty value replaces the default's. The product's reference shows the result.

## 10. Capabilities and patterns

A domain with more than a handful of use cases groups them into **capabilities**, ordered slices through Define and Design: a use case, flow or test may sit under a capability instead of the domain, and still counts in the domain. Behavior that several use cases share is written once as a **pattern** under the product, with **settings** each following use case fills in. A use case `follows` a pattern and gives each setting as a header field, a value or `Not applicable:` with a reason; a domain may follow a pattern too.

## 11. Pattern rules

A pattern's rules are `pattern_rule` records under it. Each domain that follows the pattern, itself or through a use case, owes each rule and proves it with its own tests; by default a rule needs proof only. A rule that names a `setting` does not apply in a domain whose following use cases all give that setting as Not applicable.

## 12. Citing records in prose

A record's body may cite other records by ID, such as "the loan follows TL-LEND-DR05", so that a renamed or removed record does not leave a stale reference. A citation is a whole ID-shaped token that is a record's ID or starts with a known prefix (every product and domain ID, and `idPrefixes` in `lathe.config.json`). A bare product or domain ID counts only as a code span holding just that ID, and other code is not read. The cited IDs that exist are the record's **mentions**. Mentions are not links: they count for nothing.

## 13. A product's own checks

A product keeps its house rules as checks of its own: `lathe.config.json` names a folder in `checks`, and every `*.sql` file in it runs after Lathe's, over the same tables, with the same row contract and the same header. A product check named like one of Lathe's is not run. Its checks appear in the product's reference with Lathe's.

## 14. Flow steps

A flow can be written as `flow_step` records under it, in `order`: each says what happens, `uses` the view, endpoint or component it goes through, and `fulfills` what it carries out. Once a flow has steps, what it fulfills is what its steps fulfill.

## 15. Folders

Client lays out each domain's specs in folders by stage: in Define, the domain model and use cases; in Design, interaction design, technical specification and the test plan; and at product level what domains share. `meta/sections.csv` names these folders and each kind's `section` says which one it sits in, so the app reads the same way whatever folders the files are in. The app groups the test plan by what each test proves: acceptance, domain rule, pattern, interaction and engineering tests.

## 16. Layers

A domain's components are grouped into **layers**, ordered parts of its technical specification such as Models, Services or Web app, as its use cases are grouped into capabilities. A component in a layer still belongs to the layer's domain everywhere a domain matters. Layers are records, so each product names its own.

## 17. Entities and the ERD

An aggregate is drawn as an ERD of the records it keeps. Each is an `entity` under the aggregate: one `root`, the record the aggregate is named for, and any number of `child` parts. Its body lists its fields in a table under a `## Fields` heading, with the columns Field, Meaning, Kind of value and Example. `has_one` and `has_many` link an entity to its parts inside the aggregate; `refers_to` may cross aggregates and domains. The app draws a domain's ERD at aggregate level and each aggregate's ERD with its entities.
