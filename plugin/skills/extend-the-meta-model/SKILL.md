---
name: extend-the-meta-model
description: Add a product's own kinds, their fields and relations to Lathe's schema, mark an obligation kind and a relation's role, or add a product's own checks. Use when a product needs a record kind or link Lathe does not have, when a house rule needs a check of its own, or when a write of a product kind or relation is refused, in a repo with lathe.config.json.
---

# Extend the meta-model

Lathe's schema is its meta-model: a table per kind with typed columns, a link table per relation, and the keys that hold them together. A product adds to it, for itself only, by declaring its own kinds and relations as data. Lathe then generates a table for each new kind, with the same keys and enforcement as its own.

Extend only when the user asks for it, or a real need keeps recurring. Never extend to make a check error or a refused write go away.

## How you write

Declarations are rows like any other: write them with Lathe's MCP tools (`add`, `set`, `remove`; `link` for links between records), never by editing files. Each write is checked and refused, with its reasons, when it breaks the model; a refusal changes nothing. Writes never commit: commit per task. In a shell the same commands are `lathe add <table> --<column> <value> ...`; `lathe add product_kind --help` prints a table's columns, as the `add` tool's input schema does.

When a write changes the product's kinds or relations, the tools' input schemas change with them: the new kind appears as a table of `add`, and a new relation in `link`.

## Before you write

1. `list` the `product_kind`, `product_kind_field` and `product_relation` tables to see what the product declares already. `lathe add --help` lists every table and relation the product has now, Lathe's and its own.
2. Read the kinds and relations near the one you need in `REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo, `lathe/REFERENCE.md` in the Lathe repo), so a new kind fits beside them.

## What a declaration does

| You add | Effect |
| --- | --- |
| A `product_kind` row | Adds the kind and its table, named after it: `id`, `title`, `<parent_kind>_id` (required, the parent record), then its fields. Its `label` is how people read it, `description` what a record of it is, `stage` and `section` where the app shows it, `id_pattern` and `id_example` how its IDs are written. |
| A `product_kind_field` row | Adds a column to that kind's table: `name` (lower case with underscores; not `id`, `title` or the parent column), `type` (`text`, `integer`, `boolean` or `date`), `required`, `description`, in `position` order. |
| A `product_relation` row with a new `name` | Adds the relation and its link table, from `source_kind` to `target_kind` (or `*` for any record), read as `forward_label` from its source and `reverse_label` from its target, each in sentence case. |
| A `product_relation` row with a name Lathe has | Lets that relation join one more pair of kinds, when its link table's ends accept the two kinds, such as `proves` from a test to the product's own obligation kind. Reuse Lathe's labels for it. |

A product kind may not take a name Lathe already has, and Lathe's own kinds cannot be widened with another parent or more required fields: that is a change to Lathe's schema, by a migration in the Lathe package, not a product's declaration. Ask the Owner when you need one.

## Obligations and roles

- `obligation: full` makes a kind's records things that must be designed, built and proved. Lathe then counts them in coverage and warns while nothing designs or proves one, exactly as for requirements and domain rules.
- `obligation: proof` makes them things that need **proof only**: coverage counts them as designed and built, gives no `satisfies` gaps and never warns `unsatisfied`, but counts and warns about proof as for any obligation. Lathe's own `pattern_rule` is proof-only.
- `obligation: none` means the kind is not an obligation.
- A relation's `role` says what its links count as: `design` (the source designs the target, like a component that `satisfies` it) or `proof` (the source proves the target, like a test that `proves` it). Leave it out for a link that only connects records.
- A new obligation kind needs at least one `proof` relation targeting it, and a `full` kind also at least one `design` relation, or it can never be covered. A `proof` link counts only from an automated or manual test.

## Example

A product wants security controls as their own obligation kind under a domain, with a required `threat`, a component that enforces one, a test that proves one, and a link to the domain rule a control protects:

```
add  { "product_kind": { "name": "security_control", "product_id": "TL", "label": "Security control",
       "description": "A control that must hold to defend against a named threat.", "parent_kind": "domain",
       "stage": "design", "section": "interaction-design", "obligation": "full",
       "id_pattern": "<P>-<D>-SC<nn>", "id_example": "TL-LEND-SC01" } }
add  { "product_kind_field": { "kind": "security_control", "position": 1, "name": "threat", "type": "text", "required": true,
       "description": "The threat the control defends against." } }

add  { "product_relation": { "name": "satisfies", "source_kind": "component", "target_kind": "security_control", "product_id": "TL",
       "role": "design", "forward_label": "Satisfies", "reverse_label": "Designed by", "description": "The component enforces the security control." } }
add  { "product_relation": { "name": "proves", "source_kind": "test", "target_kind": "security_control", "product_id": "TL",
       "role": "proof", "forward_label": "Proves", "reverse_label": "Proved by", "description": "The test proves the security control." } }
add  { "product_relation": { "name": "mitigates", "source_kind": "security_control", "target_kind": "domain_rule", "product_id": "TL",
       "forward_label": "Mitigates", "reverse_label": "Protected by", "description": "The control protects the domain rule." } }
```

`forward_label` is the link read from its source (the control *Mitigates* the rule), and `reverse_label` the link read from its target (the rule is *Protected by* the control).

A record of the new kind is then written like any other, with its ID from `next_id`:

```
add  { "security_control": { "id": "TL-LEND-SC01", "title": "Only the borrower can return a loan", "domain_id": "TL-LEND",
       "threat": "A member ends another member's loan" } }
link { "source": "TL-LEND-SC01", "relation": "mitigates", "target": "TL-LEND-DR06" }
```

Give every kind, field and relation a plain `description`; the app shows it.

## A product's own checks

A house rule the schema cannot express, such as "each aggregate has exactly one Record view use case" or "each use case's actor is one of the product's roles", is a product check, not a new kind. A check is a `check` row with the product's `product_id`:

- `name`: lower case with hyphens. Do not reuse one of Lathe's check names (`list` the `check` table to see them).
- `position`: its place in the run order; the product's checks run after Lathe's.
- `severity`: `warning` for work still to do, `error` only for a broken workspace, as Lathe does, or `error_or_warning` when its rows say which.
- `summary`: what it reports, in one sentence; `explanation`: why it matters, ending with how to fix what it reports. `REFERENCE.md` and the app show both.
- `query`: one `SELECT` over the typed tables that returns a row for each problem it finds, with the columns Lathe's own checks return; read one of theirs with `list` on `check` and write yours the same way.
- `kinds`: the kinds it concerns.

Run the `check` tool after adding one and fix what it finds; a check whose query fails is an error naming the check.

## Rules

- Keep each `description` a plain sentence; the app shows it.
- A required field must be given by every record of the kind, so a write that makes it required while a record lacks it is refused. On a kind that has records, add the field with `required: false`, `set` it on each record, then `set` the field's `required` to true.
- To remove a kind, first `remove` its records, then its fields and declaration; a declaration still in use is refused.
- Finish with the `check-and-fix` skill and report the new coverage lines for a new obligation kind.
