---
name: model-a-domain
description: Split a product into domains by business capability, then write or change a Lathe domain model - the domain record, its aggregates, their entities (the records each aggregate keeps, with their fields and the links an ERD draws), the domain events they raise and their domain rules. Use when deciding a product's domains, adding a domain, an aggregate, an entity, a domain event or a domain rule to a repo with lathe.config.json, or when deciding whether a rule belongs on an aggregate or in a use case.
---

# Model a domain

A domain model says what the product's records are, how they hold and refer to each other, and what must always be true of them, whoever changes them. It has no actors, screens or code. The app draws it as ERDs (entity-relationship diagrams): one of each domain at aggregate level, and one of each aggregate's entities.

## Step one: find the slices

Before you write any record, find the product's business capabilities and make each one a domain: a vertical slice that owns its domain model, use cases, flows, views, endpoints, components and tests. Technology is a layer inside each domain's Design stage, such as Web app, Server or Desktop, never a domain. What every domain shares, such as the app shell or sign-in, goes in a platform domain or a pattern.

Ask of each candidate domain:

- Would a person who uses the product name it, in their own words? Lending is; the frontend is not.
- Does it have its own terms, records and rules, which its language can hold?
- Would it still exist if the product were rebuilt on other technology? A capability would; a layer would not.
- Can one use case be specified, built and proved inside it, from rule to screen to test, without another domain designing the same thing again?
- Is it named for what it does for someone, rather than where its code runs (web app, API, server, database, desktop, mobile, engine)?

A candidate that fails these is a layer or a platform concern, not a domain. A domain named for a technology is a `domain-named-for-technology` warning.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means. In a shell, `lathe add <table> --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- A record is a row of its kind's table: `id`, `title`, the column naming its parent (`domain_id`, `aggregate_id`, ...), then its own columns. Give every parent column the kind has above it too: a domain rule under an entity names its `entity_id`, `aggregate_id` and `domain_id`. Or add it under the domain and `move` it: move fills them in.
- Take each new record's ID from `next_id`. IDs are never reused or renumbered.

## Before you write

1. Read the product (`show` its ID) and the domain's existing records (`list` each kind with the domain as `parent`, and `show` the ones you change).
2. `list` the domain's aggregates, entities, events and rules before adding one, so a new record does not repeat an old one.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `domain` | the product (`product_id`) | `<P>-<D>` | `description`: what the domain covers. `notes`: its language, the terms and their meanings, as a Markdown table. |
| `aggregate` | the domain (`domain_id`) | `<P>-<D>-A<n>` | One cluster of records changed together, named for its root. `description`, and `identity`: its business identity. A `relates_to` link to each aggregate it refers to by ID. |
| `entity` | an aggregate (`aggregate_id`) | `<P>-<D>-EN<nn>`, numbered across the domain | One record the aggregate keeps: one box of its ERD. `role`: `root` for the record the aggregate is named for (exactly one per aggregate; the store refuses any other count), `child` for each of its parts. `description`: what it is. Its fields are `entity_field` rows. |
| `entity_field` (part) | an entity (`entity_id`) | its `position`, 1, 2, 3 | One field: `name`, `meaning`, `type` (the kind of value) and `example`. |
| `domain_event` | an aggregate (`aggregate_id`) | `<P>-<D>-EV<nn>`, numbered across the domain | Something that happened in the domain, which the aggregate raises. Title in the past tense (Loan opened). `description`: what happened and what raises it. What it carries are `event_field` rows, with the same columns as an entity's fields. |
| `domain_rule` | an entity, an aggregate, or the domain for a rule across its aggregates | `<P>-<D>-DR<nn>` | One fact that must always hold. `statement`: the rule in one sentence with MUST / MUST NOT. Title: the rule in a few words. `domain_id` always; `aggregate_id` for the aggregate it constrains; `entity_id` too when the aggregate has many rules and this one is about that entity. |

## Entities

- Start from the root: the record the aggregate is named for. Add a child only for a part that lives and dies with the root, such as a line of an order or a step of a process. Anything with a life of its own is the root of another aggregate.
- Link each child from the root, or from the child it is part of, with `has_one` or `has_many`. A child nothing reaches is an `entity-unreferenced` warning.
- A reference to a record elsewhere is `refers_to`, never `has_one` or `has_many`: parts stay in their aggregate. When an aggregate's entities refer to another aggregate's, also link the aggregates with `relates_to`.
- One `entity_field` row per field, each name once, in the domain's terms. `type` says what values it takes (text, a whole number, a date and time, one of a list, the ID of another entity); `example` gives one real-looking value.

## Domain events

- Add an event for something that happened that other parts of the product care about: another aggregate changes, a use case starts, or a component does its work. Leave out what nothing would ever react to, such as a screen being scrolled.
- Name it in the past tense, subject first: Loan opened, Tool returned, Loan became overdue. A title that does not read as past tense is an `event-tense` warning.
- `raised_by` links it to the entity of its own aggregate whose change raises it. Leave it out when no entity's change raises it, such as an event raised by time passing, and say so in its description.
- Link what reacts to it with `reacts_to`, from the reacting record: an aggregate that changes (from any aggregate or domain), a use case that starts, or a component that handles it. An event nothing reacts to is an `event-unheard` warning; that can be fine for an event kept for the record.
- Its fields list what the event carries, not the whole entity: the IDs it concerns, when it happened, and the values that changed.

## Rule or requirement?

- A statement about records, fields and their states only is a **domain rule** on the aggregate it constrains.
- A rule that holds across two or more aggregates of one domain, such as records saved together or a lifecycle rule for every record, sits under the domain (no `aggregate_id`), with an `involves` link to each aggregate it ties together; a rule across domains is a domain event that one raises and the other reacts to.
- A statement that needs an actor or an action is a **requirement** on a use case (see the `write-use-cases` skill).
- Something undecided is a `question` with an `owner`, linked with `about` to the records it concerns. The owner is a role, such as Owner, never a person's name. Never write "TBD" into a rule.

## Example

An aggregate that refers to two others, with its root and one child:

```
add  { "aggregate": { "id": "TL-LEND-A3", "title": "Loan", "domain_id": "TL-LEND",
       "description": "One member holding one tool, from borrowing to return.", "identity": "Loan ID" } }
link { "source": "TL-LEND-A3", "relation": "relates_to", "target": "TL-LEND-A1" }
link { "source": "TL-LEND-A3", "relation": "relates_to", "target": "TL-LEND-A2" }

add  { "entity": { "id": "TL-LEND-EN01", "title": "Loan", "aggregate_id": "TL-LEND-A3", "role": "root",
       "description": "One member holding one tool, from borrowing to return." } }
add  { "entity_field": { "entity_id": "TL-LEND-EN01", "position": 1, "name": "Loan ID",
       "meaning": "The loan's identity.", "type": "Text", "example": "L-0042" } }
add  { "entity_field": { "entity_id": "TL-LEND-EN01", "position": 2, "name": "Due at",
       "meaning": "When the loan should end.", "type": "Date and time: Borrowed at plus 14 days", "example": "2026-03-16T10:00:00Z" } }

add  { "entity": { "id": "TL-LEND-EN02", "title": "Renewal", "aggregate_id": "TL-LEND-A3", "role": "child",
       "description": "One extension of a loan's due date." } }
link { "source": "TL-LEND-EN01", "relation": "has_many", "target": "TL-LEND-EN02" }
link { "source": "TL-LEND-EN01", "relation": "refers_to", "target": "TL-MEM-EN01" }
```

An event the root raises, which the Tool aggregate reacts to, since the tool is no longer available:

```
add  { "domain_event": { "id": "TL-LEND-EV05", "title": "Loan opened", "aggregate_id": "TL-LEND-A3",
       "description": "A librarian lent a tool to a member, which opens a loan." } }
add  { "event_field": { "domain_event_id": "TL-LEND-EV05", "position": 1, "name": "Loan ID",
       "meaning": "The loan that opened.", "type": "Loan reference", "example": "L-0042" } }
link { "source": "TL-LEND-EV05", "relation": "raised_by", "target": "TL-LEND-EN01" }
link { "source": "TL-LEND-A2", "relation": "reacts_to", "target": "TL-LEND-EV05" }
```

A rule on the Tool aggregate:

```
add  { "domain_rule": { "id": "TL-LEND-DR06", "title": "A tool is lent to one member at a time",
       "domain_id": "TL-LEND", "aggregate_id": "TL-LEND-A2",
       "statement": "A tool MUST NOT have more than one active loan; it can be lent again once its loan is returned." } }
```

In a shell the same writes are `lathe add aggregate --id TL-LEND-A3 --title Loan --domain_id TL-LEND ...` and `lathe link TL-LEND-A3 relates_to TL-LEND-A1`.

## Rules

- Records carry no status, approval or history. A record in the data is in force; git holds the history.
- One rule per `domain_rule` record. Use the domain's terms exactly as its language defines them.
- When a question is decided, `remove` the question (its `about` links go with it), and write the answer into the records it affects.
- Specs name roles, never people: write "a librarian" or "the owner", not someone's name.
- The store refuses what breaks the model outright, such as a second root, a link between kinds its relation does not join, or a field position used twice; the checks warn about the rest. Each check's explanation, with how to fix what it reports, is in `REFERENCE.md` in the Lathe package.
- Finish with the `check-and-fix` skill. A new domain rule shows as a warning until a component satisfies it and a test proves it; that is expected.
