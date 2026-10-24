---
name: extend-the-meta-model
description: Add a product's own kinds and relations to Lathe's meta-model, widen a default kind, or mark an obligation kind and a relation's role, through the product's metaExtensions folder. Use when a product needs a record kind or link Lathe does not have, when a default kind's allowed parents or required fields do not fit, or when a check error comes from a meta-model CSV, in a repo with lathe.config.json.
---

# Extend the meta-model

Lathe's meta-model (`meta/kinds.csv` and `meta/relations.csv` in the Lathe package) says which kinds of record exist, where each may sit, which fields it needs, and which links are allowed. A product adds to it, for itself only, with the CSV files in the folder its `lathe.config.json` names as `metaExtensions`:

```json
{ "specs": "specs", "metaExtensions": "lathe-meta" }
```

Extend only when the user asks for it, or a real need keeps recurring. Never extend to make a check error go away.

## Before you write

1. Read section 9 of `FORMAT.md` in the Lathe package (`node_modules/@jaredrob/lathe/FORMAT.md` in a product repo, `lathe/FORMAT.md` in the Lathe repo) and the default `meta/kinds.csv` and `meta/relations.csv`.
2. Read the product's existing `metaExtensions` files, if any. Use the same columns as the defaults, header row included.

## What a row does

| You write | Effect |
| --- | --- |
| A `kinds.csv` row for a new kind | Adds the kind. |
| A `kinds.csv` row for a kind that already exists | **Widens** it: its `parent_kinds` and `required_fields` are added to the default's; a non-empty `label`, `stage`, `obligation` or `description` replaces the default's. Leave a column empty to keep the default. |
| A `relations.csv` row for a new relation, or a new source and target for an existing one | Adds that link rule. |
| A `relations.csv` row identical to an existing one | Changes nothing. |
| Two rows for the same kind in one folder | Error `meta-duplicate-kind`. Merge them. |

A widening can only add: it cannot remove a default parent kind, required field or relation.

## Obligations and roles

- `obligation: yes` on a kind makes its records things that must be designed, built and proved. Lathe then counts them in coverage and warns while nothing designs or proves one, exactly as for requirements and domain rules.
- A relation's `role` says what its links count as: `design` (the source designs the target, like a component that `satisfies` it) or `proof` (the source proves the target, like a test that `proves` it). Leave it empty for a link that only connects records.
- A new obligation kind needs at least one `design` relation and one `proof` relation targeting it, or it can never be covered. A `proof` link counts only from an automated or manual test.

## Example

A product wants security controls as their own obligation kind under a domain, and wants to state some domain rules directly on the domain rather than on an aggregate.

`lathe-meta/kinds.csv`:

```csv
kind,label,stage,parent_kinds,required_fields,obligation,description
security_control,Security control,design,domain,threat,yes,"A control that must hold to defend against a named threat."
domain_rule,,,domain,,,
```

The first row adds a kind with a required `threat` field and marks it an obligation. The second widens `domain_rule`: it may now sit under a `domain` as well as an `aggregate`; everything else stays as Lathe defines it.

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

Pick an ID pattern for the new kind (here `<P>-<D>-SC<nn>`) and use it consistently; Lathe checks only the format and uniqueness.

## A product's own checks

A house rule that the meta-model cannot express, such as S2's "each aggregate has exactly one Record view use case", is a product check, not an extension. Name a folder in `lathe.config.json` (`"checks": "lathe-checks"`) and add one `<number>-<check-name>.sql` file per rule, written as Lathe's own checks are: one `SELECT` over the same tables (`records`, `fields`, `links`, ...) returning `severity`, `"check"`, `record` and `message`. See section 13 of `FORMAT.md`.

- The check's name is the file name without its number and `.sql`. Do not reuse one of Lathe's check names: that file is not run, and is a `product-check-name-clash` error.
- Use `warning` for work still to do and `error` only for a broken workspace, as Lathe does.
- Product checks run after Lathe's, and a check whose SQL fails is an error naming its file. Run `lathe check` after adding one and fix what it finds.

## Rules

- Keep each row's `description` a plain sentence; the web app shows it.
- Required field names are lower-case letters, digits and underscores, never `id`, `kind`, `title`, `parent` or `links` (`meta-bad-required-field`).
- Every kind named in `parent_kinds`, `source_kind` or `target_kind` must exist in the defaults or the extension (`meta-unknown-parent-kind`, `meta-unknown-relation-kind`).
- Widening a kind with a new required field makes every existing record of that kind need it. Add the field to those records in the same change.
- The plugin's hook runs the check after each edit to these CSVs. Finish with the `check-and-fix` skill and report the new coverage lines for the new obligation kind.
