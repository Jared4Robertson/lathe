---
name: model-a-domain
description: Write or change a Lathe domain model - the domain record, its aggregates and their domain rules. Use when adding a domain, an aggregate or a domain rule to a repo with lathe.config.json, or when deciding whether a rule belongs on an aggregate or in a use case.
---

# Model a domain

A domain model says what the product's records are and what must always be true of them, whoever changes them. It has no actors, screens or code.

## Before you write

1. Find the repo root (the folder with `lathe.config.json`) and its specs folder (`specs` unless the config says otherwise).
2. Read the record format: `FORMAT.md` in the Lathe package (`node_modules/@jaredrob/lathe/FORMAT.md` in a product repo, `lathe/FORMAT.md` in the Lathe repo), and the kinds and relations in its `meta/` folder.
3. Read the product record and the domain's existing records. Find the highest number in use for each kind before adding one. IDs are never reused or renumbered.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `domain` | the product | `<P>-<D>` | What the domain covers, and its language: a table of terms and their meanings. |
| `aggregate` | the domain | `<P>-<D>-A<n>` | One cluster of records changed together: its business identity, and a table of fields (business meaning, kind of value, example). `relates_to` the aggregates it refers to by ID. |
| `domain_rule` | an aggregate | `<P>-<D>-DR<nn>` | One fact that must always hold for that aggregate. Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT. |

Put the files under the domain folder, for example `<domain>/01-define/aggregates/A3-loan.md` and `<domain>/01-define/domain-rules/DR06-one-active-loan-per-tool.md`. Folder names are for people; only the fields matter to Lathe.

## Rule or requirement?

- A statement about records, fields and their states only is a **domain rule** on the aggregate it constrains.
- A statement that needs an actor or an action is a **requirement** on a use case (see the `write-use-cases` skill).
- Something undecided is an open `question` with an `owner`, linked `about` the records it concerns. Never write "TBD" into a rule.

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

| Field | Business meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Borrowed at | When the loan started. | Date and time. | 2026-03-02T10:00:00Z |
| Due at | When the loan should end. | Date and time: Borrowed at plus 14 days. | 2026-03-16T10:00:00Z |
```

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
- Finish with the `check-and-fix` skill. A new domain rule shows as a warning until a component satisfies it and a test proves it; that is expected.
