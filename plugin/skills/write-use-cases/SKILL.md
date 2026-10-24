---
name: write-use-cases
description: Write or change Lathe use cases and their requirements. Use when adding what an actor does with the product, splitting a use case, or stating the rules a use case must follow, in a repo with lathe.config.json.
---

# Write use cases

A use case is something an actor does with the product to reach a goal. Its requirements are the rules it must follow, one per record, each testable on its own.

## Before you write

1. Read the domain record (its language table) and the aggregates and domain rules the use case touches. Use those terms exactly.
2. Read the domain's existing use cases and take the next free number. IDs are never reused or renumbered.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `use_case` | the domain | `<P>-<D>-UC<nn>` | Required field `actor`. Body: the goal in one sentence, the main steps as a numbered list, then what happens when a step fails. `applies` the domain rules it relies on. |
| `requirement` | the use case | `<use case>-R<nn>` | Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT / SHOULD / MAY. |

Keep each use case's requirements in a folder next to it: `use-cases/UC03-borrow-a-tool.md` and `use-cases/UC03-borrow-a-tool/R01-due-date-shown.md`.

## Example

```markdown
---
id: TL-LEND-UC03
kind: use_case
title: Borrow a tool
parent: TL-LEND
actor: Member
links:
  applies: [TL-LEND-DR02, TL-LEND-DR03, TL-LEND-DR05, TL-LEND-DR06, TL-LEND-DR07]
---
A member borrows an available tool for the loan period.

1. The member picks a tool from the catalog.
2. The library checks the member can borrow and the tool can be lent.
3. The library records the loan and tells the member when it is due.
```

```markdown
---
id: TL-LEND-UC03-R02
kind: requirement
title: An unavailable tool is refused with the reason
parent: TL-LEND-UC03
---
Borrowing MUST be refused when the tool is on loan or needs repair, and the response MUST say which.
```

## Rules

- A requirement does not restate a domain rule; the use case `applies` the rule instead. Write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- A requirement says what, not how. Screens, routes and code belong to the design (see `design-the-domain`).
- Every use case needs at least one requirement; one with none is a warning.
- Something undecided is an open `question` with an `owner`, linked `about` the use case, never "TBD" in a requirement.
- Finish with the `check-and-fix` skill.
