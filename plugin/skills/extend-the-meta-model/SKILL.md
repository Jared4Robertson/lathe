---
name: extend-the-meta-model
description: Add a product's own kinds and relations to Lathe's meta-model, widen a default kind, or mark an obligation kind and a relation's role, through the product's metaExtensions folder. Use when a product needs a record kind or link Lathe does not have, when a default kind's allowed parents or required fields do not fit, or when a check error comes from a meta-model CSV, in a repo with lathe.config.json.
---

# Extend the meta-model

Lathe's meta-model (`meta/kinds.csv`, `meta/relations.csv` and `meta/sections.csv` in the Lathe package) says which kinds of record exist, where each may sit, which fields it needs, which links are allowed, and which folder each kind is read in. A product adds to it, for itself only, with the CSV files in the folder its `lathe.config.json` names as `metaExtensions`:

```json
{ "specs": "specs", "metaExtensions": "lathe-meta" }
```

Extend only when the user asks for it, or a real need keeps recurring. Never extend to make a check error go away.

## Before you write

1. Read section 9 of `FORMAT.md` in the Lathe package (`node_modules/@jaredrob/lathe/FORMAT.md` in a product repo, `lathe/FORMAT.md` in the Lathe repo), and run `npx lathe format` to see every kind, relation and folder the product has now. The default rows are in the package's `meta/kinds.csv`, `meta/relations.csv`, `meta/sections.csv` and `meta/ids.csv`.
2. Read the product's existing `metaExtensions` files, if any. Use the same columns as the defaults, header row included.

## What a row does

| You write | Effect |
| --- | --- |
| A `kinds.csv` row for a new kind | Adds the kind. |
| A `kinds.csv` row for a kind that already exists | **Widens** it: its `parent_kinds` and `required_fields` are added to the default's; a non-empty `label`, `stage`, `section`, `obligation` or `description` replaces the default's. Leave a column empty to keep the default. |
| A `sections.csv` row for a new folder, or for one that already exists | Adds the folder, or replaces its `stage`, `order`, `label` or `description` with any that is non-empty. |
| A `relations.csv` row for a new relation, or a new source and target for an existing one | Adds that link rule. |
| A `relations.csv` row identical to an existing one | Changes nothing. |
| Two rows for the same kind in one folder | Error `meta-duplicate-kind`. Merge them. |
| A kind whose `section` is not a listed folder, or a folder of another stage | Error `unknown-section` or `section-stage-mismatch`. |

A widening can only add: it cannot remove a default parent kind, required field or relation.

## Folders

Each kind's `section` column names the folder it is read in, as Client lays out a domain's specs: `domain-model` and `use-cases` in the Define stage, `interaction-design`, `technical-specification` and `test-plan` in the Design stage, and `shared` (patterns) at product level. The folders, their order and labels are the rows of `sections.csv` (`section, stage, order, label, description`). A new kind should name a folder of its own stage; one with no `section` gets a folder of its own in the app. Components go in layers: a `layer` sits under a domain in the `technical-specification` folder, and a `component` sits in a layer, or in the domain when it has none. Layers are records each product names, not a field, so a product needs no extension to add its own. To move a default kind, widen it with just its `section`, such as `domain_rule,,,use-cases,,,,`; to add a folder, add a `sections.csv` row. See section 15 of `FORMAT.md`.

## Obligations and roles

- `obligation: yes` (or `true`) on a kind makes its records things that must be designed, built and proved. Lathe then counts them in coverage and warns while nothing designs or proves one, exactly as for requirements and domain rules.
- `obligation: proof` makes them things that need **proof only**: coverage counts them as designed and built, gives no `satisfies` gaps and never warns `unsatisfied`, but counts and warns about proof as for any obligation. Lathe's own `pattern_rule` is proof-only. To ask for the design of pattern rules too, widen it with `pattern_rule,,,,,,yes,`.
- Any other value, or an empty one on a new kind, means the kind is not an obligation. The value is read in any letter case.
- A relation's `role` says what its links count as: `design` (the source designs the target, like a component that `satisfies` it) or `proof` (the source proves the target, like a test that `proves` it). Leave it empty for a link that only connects records.
- A new obligation kind needs at least one `proof` relation targeting it, and a `yes` kind also at least one `design` relation, or it can never be covered. A `proof` link counts only from an automated or manual test.

## Example

A product wants security controls as their own obligation kind under a domain, and wants to state some domain rules directly on the domain rather than on an aggregate.

`lathe-meta/kinds.csv`:

```csv
kind,label,stage,section,parent_kinds,required_fields,obligation,description
security_control,Security control,design,interaction-design,domain,threat,yes,"A control that must hold to defend against a named threat."
domain_rule,,,,domain,,,
```

The first row adds a kind with a required `threat` field, marks it an obligation, and puts it in the Design stage's Interaction design folder, where the side nav and the domain page list it. The second widens `domain_rule`: it may now sit under a `domain` as well as an `aggregate`; everything else stays as Lathe defines it.

`lathe-meta/relations.csv`:

```csv
relation,source_kind,target_kind,role,description
satisfies,component,security_control,design,"The component enforces the security control."
proves,test,security_control,proof,"The test proves the security control."
mitigates,security_control,domain_rule,,"The control protects the domain rule."
```

A record of the new kind then reads like any other:

```markdown
---
id: TL-LEND-SC01
kind: security_control
title: Only the borrower can return a loan
parent: TL-LEND
threat: A member ends another member's loan
links:
  mitigates: [TL-LEND-DR06]
---
Returning a loan MUST be refused unless the caller is the member who borrowed it.
```

Pick an ID pattern for the new kind (here `<P>-<D>-SC<nn>`), add it as an `ids.csv` row (`kind,pattern,example`) so the reference shows it, and use it consistently; Lathe checks only the format and uniqueness. Give every new kind and relation a `description`: an empty one is an `undocumented` error.

## A product's own checks

A house rule that the meta-model cannot express, such as Client's "each aggregate has exactly one Record view use case", is a product check, not an extension. Name a folder in `lathe.config.json` (`"checks": "lathe-checks"`) and add one `<number>-<check-name>.sql` file per rule, written as Lathe's own checks are: one `SELECT` over the same tables (`records`, `fields`, `links`, ...) returning `severity`, `"check"`, `record` and `message`, under a header comment that documents it (a summary sentence, a blank comment line, the explanation and how to fix it, a blank comment line, then `-- severity: warning` and an optional `-- kinds: aggregate`). See section 5 and section 13 of `FORMAT.md`; a check without that header is an `undocumented` error, and `lathe format` shows the product's checks with Lathe's.

- The check's name is the file name without its number and `.sql`. Do not reuse one of Lathe's check names: that file is not run, and is a `product-check-name-clash` error.
- Use `warning` for work still to do and `error` only for a broken workspace, as Lathe does.
- Product checks run after Lathe's, and a check whose SQL fails is an error naming its file. Run `lathe check` after adding one and fix what it finds.

## Rules

- Keep each row's `description` a plain sentence; the web app shows it.
- Required field names are lower-case letters, digits and underscores, never `id`, `kind`, `title`, `parent` or `links` (`meta-bad-required-field`).
- Every kind named in `parent_kinds`, `source_kind` or `target_kind` must exist in the defaults or the extension (`meta-unknown-parent-kind`, `meta-unknown-relation-kind`).
- Widening a kind with a new required field makes every existing record of that kind need it. Add the field to those records in the same change.
- The plugin's hook runs the check after each edit to these CSVs. Finish with the `check-and-fix` skill and report the new coverage lines for the new obligation kind.
