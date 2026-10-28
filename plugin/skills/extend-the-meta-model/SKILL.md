---
name: extend-the-meta-model
description: Add a product's own kinds to Lathe's schema in any of the six stages (discovery, domain model, use cases, interaction design, technical specification, test plan), with their fields and relations, mark an obligation kind and a relation's role, or add a product's own checks. Use when a product needs a record kind or link Lathe does not have, such as a technical kind for code no Lathe kind fits, when a house rule needs a check of its own, or when a write of a product kind or relation is refused, in a repo with lathe.config.json.
---

# Extend the meta-model

Lathe's schema is its meta-model: a table per kind with typed columns, a link table per relation, and the keys that hold them together. A product adds to it, for itself only, by declaring its own kinds and relations as data. Lathe then makes a table for each new kind, with the same keys and enforcement as its own.

Extend only when the user asks for it, or a real need keeps recurring. Never extend to make a check error or a refused write go away. Lathe is opinionated: before declaring a kind, make sure none of Lathe's fits (`lathe add --help` lists them, stage by stage in `REFERENCE.md`). The most common need is a technical kind for code that implements no design record, such as a server's entry point, a CLI command or a migration.

## How you write

Declarations are rows like any other: write them with Lathe's MCP tools (`add`, `set`, `remove`; `link` for links between records), never by editing files. Each write is checked and refused, with its reasons, when it breaks the model; a refusal changes nothing. Writes never commit: commit per task. In a shell the same commands are `lathe add <table> --<column> <value> ...`; `lathe add product_kind --help` prints a table's columns, as the `add` tool's input schema does.

When a write changes the product's kinds or relations, the tools' input schemas change with them: the new kind appears as a table of `add` and a kind of `next_id`, and a new relation in `link`.

## Before you write

1. `list` the `product_kind`, `product_kind_field` and `product_relation` tables to see what the product declares already.
2. Read the kinds near the one you need in `REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo, `lathe/REFERENCE.md` in the Lathe repo), so a new kind fits beside them.

## What a declaration does

| You add | Effect |
| --- | --- |
| A `product_kind` row | Adds the kind and its table, named after it: `id`, `title`, `<parent_kind>_id` (required: its one parent, of one of Lathe's kinds or another product kind), then its fields. `label` is how people read it, `description` what a record of it is, `stage` the stage it belongs to, `obligation` whether its records are obligations, `id_pattern` and `id_example` how its IDs are written. |
| A `product_kind_field` row | Adds a column to that kind's table: `name` (lower case with underscores; not `id`, `title` or the parent column), `type` (`text`, `integer`, `boolean` or `date`), `required`, `description`, in `position` order. |
| A `product_relation` row with a new `name` | Adds the relation and its link table, from `source_kind` to `target_kind` (or `*` for any record), read as `forward_label` from its source and `reverse_label` from its target, each in sentence case. Its links stay inside one product. |
| A `product_relation` row with a name Lathe has | Lets that relation join one more pair of kinds, when its link table's ends accept the two kinds. Most of Lathe's link tables accept only the kinds they name, so this is rare; a new relation is the usual way. Reuse Lathe's labels for it. |

A product kind may not take a table name Lathe has, and Lathe's own kinds cannot be given another parent or more required fields: that is a change to Lathe's schema, in the Lathe package, not a product's declaration. Ask the Owner when you need one.

## The six stages

A product kind sits in any of the six stages, or in none, and the app shows it there, in that stage's color:

- `discovery`: something about why the product exists that a business outcome leaves out, such as a persona or a market, under the product.
- `domain-model`: a domain concept Lathe's DDD kinds leave out, such as a saga, under the domain.
- `use-cases`: something a use case owns, such as an acceptance criterion's example, under the use case.
- `interaction-design`: a design record of a channel Lathe has no kind for, such as an email template or a CLI command's usage, under the command it exposes or the domain.
- `technical-specification`: code that implements no design record, such as an entry point, a migration or a graph layout, under the domain or the design record it serves.
- `test-plan`: a test kind of the product's own, under what it proves, or what tests need besides a test data set.

Its `id_pattern` is its own, such as `<domain>-ENTRY<nn>` or `<command>-CLI`: start it with the parent kind's name in angle brackets, so `next_id` numbers it under the parent and every ID starts with its parent's.

## Obligations and roles

- `obligation: true` makes the kind's records obligations: Lathe counts them in coverage, designed, built and proved, and reports the gaps, as it does for invariants and UC requirements. `REFERENCE.md` says how coverage reads a product's obligation kinds.
- A new relation's `role` says what its links count toward: `design` (the source designs the target) or `proof` (the source proves it). Leave it out for a link that only connects records.

## Example: the Tool Library's entry point

No technical kind fits `src/server.ts`, which starts the library: it implements no design record. The Tool Library declares an entry point, in the technical specification, under the domain:

```
add  { "product_kind": { "name": "entry_point", "product_id": "TL", "label": "Entry point",
       "description": "A file that starts the product: it reads its settings, opens its storage and serves its endpoints.",
       "parent_kind": "domain", "stage": "technical-specification", "obligation": false,
       "id_pattern": "<domain>-ENTRY<nn>", "id_example": "TL-LEND-ENTRY01" } }
add  { "product_kind_field": { "kind": "entry_point", "position": 1, "name": "file", "type": "text", "required": true,
       "description": "The file, from the product root." } }
add  { "product_kind_field": { "kind": "entry_point", "position": 2, "name": "description", "type": "text", "required": false,
       "description": "What it does at start-up." } }
```

A record of the new kind is then written like any other, with its ID from `next_id` (`kind`: `entry_point`, `parent`: the domain):

```
add  { "entry_point": { "id": "TL-LEND-ENTRY01", "title": "server.ts", "domain_id": "TL-LEND", "file": "src/server.ts",
       "description": "Opens the store and serves the router on PORT, with the library's time zone from TIME_ZONE." } }
```

A relation of the product's own, from a kind of its own to one of Lathe's:

```
add  { "product_relation": { "name": "starts_up", "source_kind": "entry_point", "target_kind": "endpoint", "product_id": "TL",
       "forward_label": "Starts up", "reverse_label": "Started up by", "description": "The entry point starts up the endpoint when the product starts." } }
link { "source": "TL-LEND-ENTRY01", "relation": "starts_up", "target": "TL-LEND-EP01" }
```

Give every kind, field and relation a plain `description`; the app shows it.

## A product's own checks

A house rule the schema cannot express, such as "every command has an endpoint", is a product check, not a new kind. A check is a `check` row with the product's `product_id`:

- `name`: lower case with hyphens. Do not reuse one of Lathe's check names (`list` the `check` table to see them).
- `position`: its place in the run order; the product's checks run after Lathe's.
- `severity`: `warning` for work still to do, `error` only for a broken workspace, as Lathe does, or `error_or_warning` when its rows say which.
- `summary`: what it reports, in one sentence; `explanation`: why it matters, ending with how to fix what it reports. `REFERENCE.md` and the app show both.
- `query`: one `SELECT` over the typed tables that returns a row for each problem it finds, with the columns Lathe's own checks return; read one of theirs with `list` on `check` and write yours the same way. The views `record_parent`, `record_scope`, `link` and `record_group` help: a record's parent, its product, domain and aggregate, every link of every relation, and a record's group (a flow step's path, or the `group_name` of any kind that has one, yours included).
- `kinds`: the kinds it concerns.

Run the `check` tool after adding one and fix what it finds; a check whose query fails is an error naming the check.

## Rules

- Keep each `description` a plain sentence; the app shows it.
- A required field must be given by every record of the kind, so a write that makes it required while a record lacks it is refused. On a kind that has records, add the field with `required: false`, `set` it on each record, then `set` the field's `required` to true.
- To remove a kind, first `remove` its records, then its fields and declaration; a declaration still in use is refused.
- Finish with the `check-and-fix` skill, and report the new coverage lines for a new obligation kind.
