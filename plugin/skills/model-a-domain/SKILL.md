---
name: model-a-domain
description: Split a product into domains by business capability, then write or change a Lathe domain model - the domain record, its aggregates, their entities (the records each aggregate keeps, with their fields and the links an ERD draws), the domain events they raise and their domain rules. Use when deciding a product's domains, adding a domain, an aggregate, an entity, a domain event or a domain rule to a repo with lathe.config.json, or when deciding whether a rule belongs on an aggregate or in a use case.
---

# Model a domain

A domain model says what the product's records are, how they hold and refer to each other, and what must always be true of them, whoever changes them. It has no actors, screens or code. The app draws it as ERDs (entity-relationship diagrams): one of each domain at aggregate level, and one of each aggregate's entities.

## Step one: find the slices

Before you write any record, find the product's business capabilities and make each one a domain: a vertical slice that owns its domain model, use cases, flows, views, endpoints, components and tests (FORMAT.md section 19). Technology is a layer inside each domain's Design stage, such as Web app, Server or Desktop, never a domain. What every domain shares, such as the app shell or sign-in, goes in a platform domain or a pattern.

Ask of each candidate domain:

- Would a person who uses the product name it, in their own words? Lending is; the frontend is not.
- Does it have its own terms, records and rules, which its language table can hold?
- Would it still exist if the product were rebuilt on other technology? A capability would; a layer would not.
- Can one use case be specified, built and proved inside it, from rule to screen to test, without another domain designing the same thing again?
- Is it named for what it does for someone, rather than where its code runs (web app, API, server, database, desktop, mobile, engine)?

A candidate that fails these is a layer or a platform concern, not a domain. A domain named for a technology is a `domain-named-for-technology` warning.

## Before you write

1. Find the repo root (the folder with `lathe.config.json`) and its specs folder (`specs` unless the config says otherwise).
2. Read the record format: run `npx lathe format` (in the Lathe repo, `npm --prefix lathe run lathe -- format --root ..`), which prints the concepts and then every kind, relation, folder and check of this product, its extensions and own checks included. Lathe's defaults alone are in `REFERENCE.md` in the Lathe package (`lathe/REFERENCE.md` in the Lathe repo).
3. Read the product record and the domain's existing records. Find the highest number in use for each kind before adding one. IDs are never reused or renumbered.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `domain` | the product | `<P>-<D>` | What the domain covers, and its language: a table of terms and their meanings. |
| `aggregate` | the domain | `<P>-<D>-A<n>` | One cluster of records changed together, named for its root, and its business identity. `relates_to` the aggregates it refers to by ID. |
| `entity` | an aggregate | `<P>-<D>-EN<nn>`, numbered across the domain | One record the aggregate keeps: one box of its ERD. `role: root` for the record the aggregate is named for (exactly one per aggregate), `role: child` for each of its parts. Body: what it is, then a `## Fields` table with the columns Field, Meaning, Kind of value, Example, one row per field. Links: `has_one` (one to one) and `has_many` (one to many) to its parts in the same aggregate; `refers_to` (many to one) any entity it holds a reference to, in this aggregate or another, in this domain or another. |
| `domain_event` | an aggregate | `<P>-<D>-EV<nn>`, numbered across the domain | Something that happened in the domain, which the aggregate raises. Title: in the past tense (Loan opened). Body: one sentence saying what happened and what raises it, then a `## Fields` table of what it carries, with the same columns as an entity's. Links: `raised_by` the entity of this aggregate whose change raises it, if one does. |
| `domain_rule` | an aggregate, the entity of it the rule is about, or the domain for a rule across its aggregates | `<P>-<D>-DR<nn>` | One fact that must always hold for that aggregate. Put it under an entity when the aggregate has many rules and the rule is about that one entity; it still belongs to the aggregate. Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT. |

Put the files under the domain folder, for example `<domain>/01-define/aggregates/A3-loan.md`, its entities in `<domain>/01-define/aggregates/loan/EN01-loan.md`, its events in `<domain>/01-define/aggregates/loan/events/EV05-loan-opened.md`, and `<domain>/01-define/domain-rules/DR06-one-active-loan-per-tool.md`. Folder names are for people; only the fields matter to Lathe.

## Entities

- Start from the root: the record the aggregate is named for. Add a child only for a part that lives and dies with the root, such as a line of an order or a step of a process. Anything with a life of its own is the root of another aggregate.
- Link each child from the root, or from the child it is part of, with `has_one` or `has_many`. A child nothing reaches is an `entity-unreferenced` warning.
- A reference to a record elsewhere is `refers_to`, never `has_one` or `has_many`: parts stay in their aggregate (`has-crosses-aggregate`). When an aggregate's entities refer to another aggregate's, also give the aggregate a `relates_to` link to it.
- One row per field, each name once, in the domain's terms. Kind of value says what values it takes (text, a whole number, a date and time, one of a list, the ID of another entity); Example gives one real-looking value.

## Domain events

- Add an event for something that happened that other parts of the product care about: another aggregate changes, a use case starts, or a component does its work. Leave out what nothing would ever react to, such as a screen being scrolled.
- Name it in the past tense, subject first: Loan opened, Tool returned, Loan became overdue. A title that does not read as past tense is an `event-tense` warning.
- `raised_by` names an entity of the event's own aggregate (`raised-by-outside-aggregate` otherwise). Leave it out when no entity's change raises it, such as an event raised by time passing, and say so in the body.
- Say what reacts on the reacting record, with `reacts_to: [<event>]`: an aggregate that changes (from any aggregate or domain), a use case that starts, or a component that handles it. An event nothing reacts to is an `event-unheard` warning; that can be fine for an event kept for the record.
- The Fields table lists what the event carries, not the whole entity: the IDs it concerns, when it happened, and the values that changed.

## Rule or requirement?

- A statement about records, fields and their states only is a **domain rule** on the aggregate it constrains.
- A rule that holds across two or more aggregates of one domain, such as records saved together or a lifecycle rule for every record, goes under the domain, with `involves` naming each aggregate it ties together; a rule across domains is a domain event that one raises and the other reacts to.
- A statement that needs an actor or an action is a **requirement** on a use case (see the `write-use-cases` skill).
- Something undecided is an open `question` with an `owner`, linked `about` the records it concerns. The owner is a role, such as Owner, never a person's name. Never write "TBD" into a rule.

## Example

```markdown
---
id: TL-LEND-A3
kind: aggregate
title: Loan
parent: TL-LEND
links:
  relates_to: [TL-LEND-A1, TL-LEND-A2]
---
One member holding one tool, from borrowing to return.

**Business identity:** Loan ID.
```

```markdown
---
id: TL-LEND-EN01
kind: entity
title: Loan
parent: TL-LEND-A3
role: root
links:
  has_many: [TL-LEND-EN02]
  refers_to: [TL-LEND-EN05, TL-MEM-EN01]
---
One member holding one tool, from borrowing to return.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | The loan's identity. | Text | L-0042 |
| Borrowed at | When the loan started. | Date and time | 2026-03-02T10:00:00Z |
| Due at | When the loan should end. | Date and time: Borrowed at plus 14 days | 2026-03-16T10:00:00Z |
```

```markdown
---
id: TL-LEND-EN02
kind: entity
title: Renewal
parent: TL-LEND-A3
role: child
---
One extension of a loan's due date.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Renewed at | When the loan was renewed. | Date and time | 2026-03-12T09:00:00Z |
| New due at | The due date after renewal. | Date and time | 2026-03-26T10:00:00Z |
```

```markdown
---
id: TL-LEND-EV05
kind: domain_event
title: Loan opened
parent: TL-LEND-A3
links:
  raised_by: [TL-LEND-EN01]
---
A librarian lent a tool to a member, which opens a loan.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | The loan that opened. | Loan reference | L-0042 |
| Tool | Which tool was lent. | Tool reference | Tool 7 |
| Due at | When the loan should end. | Date and time | 2026-03-16T10:00:00Z |
```

The Tool aggregate reacts to it, since the tool is no longer available: `TL-LEND-A2` has `links: reacts_to: [TL-LEND-EV05]`.

```markdown
---
id: TL-LEND-DR06
kind: domain_rule
title: A tool is lent to one member at a time
parent: TL-LEND-A2
---
A tool MUST NOT have more than one active loan. It can be lent again once its loan is returned.
```

## Rules

- Records carry no status, approval or history. A record in the specs is in force.
- One rule per `domain_rule` record. Use the domain's terms exactly as its language table defines them.
- When a question is decided, delete the question record and every `about` link to it, and write the answer into the records it affects.
- Specs name roles, never people: write "a librarian" or "the owner", not someone's name.
- The entity and event checks (`entity-role`, `aggregate-root`, `entity-fields`, `has-crosses-aggregate`, `entity-unreferenced`, `raised-by-outside-aggregate`, `event-unheard`, `event-tense`) are explained in the reference (`lathe format`), with how to fix each.
- Finish with the `check-and-fix` skill. A new domain rule shows as a warning until a component satisfies it and a test proves it; that is expected.
