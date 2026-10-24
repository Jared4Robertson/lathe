---
name: write-use-cases
description: Write or change Lathe use cases, their requirements, the capabilities that group them and the patterns they follow. Use when adding what an actor does with the product, splitting a use case, grouping a domain's use cases into capabilities, writing behaviour several use cases share as a pattern, or stating the rules a use case must follow (and deciding which rules belong at a view or endpoint instead), in a repo with lathe.config.json.
---

# Write use cases

A use case is something an actor does with the product to reach a goal. Its requirements are the rules it must follow, one per record, each testable on its own.

## Before you write

1. Read the domain record (its language table) and the aggregates and domain rules the use case touches. Use those terms exactly.
2. Read the domain's existing use cases and take the next free number. IDs are never reused or renumbered.
3. Read the domain's capabilities (if it has any) and the product's patterns. Put the use case in the capability it belongs to, and follow every pattern whose behaviour it shares.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `capability` | the domain | `<P>-<D>-CAP<nn>` | Required field `order`: a whole number, its place in the domain, unique within the domain. Body: what the capability covers, in a sentence or two. |
| `use_case` | the domain, or one of its capabilities | `<P>-<D>-UC<nn>` | Required field `actor`. Body: the goal in one sentence, the main steps as a numbered list, then what happens when a step fails. `applies` the domain rules it relies on; `follows` the patterns it shares, with one header field per setting. |
| `requirement` | the use case | `<use case>-R<nn>` | Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT / SHOULD / MAY. |
| `pattern` | the product | `<P>-PAT-<NAME>` | Required field `settings`: setting names separated by spaces, lower case with underscores. Body: purpose, how a use case uses it, a Settings table (setting, what the use case decides), and its rules with MUST / MUST NOT / SHOULD / MAY. |

Keep each use case's requirements in a folder next to it: `use-cases/UC03-borrow-a-tool.md` and `use-cases/UC03-borrow-a-tool/R01-due-date-shown.md`. Keep capabilities in `01-define/capabilities/` and patterns in a `patterns/` folder beside the product's domains.

## Capabilities

Once a domain has more than a handful of use cases, group them into ordered capabilities, such as 01 Membership, 02 Catalog, 03 Lending. A capability is a slice through Define and Design: put the domain's flows and acceptance tests under the same capability as the use cases they carry out and prove. Domain rules stay under their aggregates, and tests that prove only domain rules may stay under the domain.

- Moving a use case, flow or test into a capability changes only its `parent`. Never change its ID.
- Once a domain has one capability, every use case of the domain belongs in one; a use case left under the domain is a warning.
- The domain's use case index (capability, use case, pattern, in capability order) comes from these records; do not keep a hand-written copy.

## Patterns

When two or more use cases would state the same rules, write those rules once as a pattern and let each use case follow it. A setting is what each use case decides differently, such as the record it saves or the permission it needs.

- A use case that `follows` a pattern gives every setting as a plain header field named exactly as the pattern lists it: a value, or `"Not applicable: <reason>"` (quoted, because of the colon). A missing setting, or `Not applicable:` without a reason, is an error.
- The use case's requirements do not restate the pattern's rules. Write a requirement only for what this use case adds.
- Avoid two patterns with the same setting name: a use case following both has only one field for it (a warning). Rename one of the settings.
- Do not make a pattern for one use case. If only one use case has the behaviour, it is that use case's requirements.

## Example

```markdown
---
id: TL-LEND-UC03
kind: use_case
title: Borrow a tool
parent: TL-LEND-CAP03
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

A capability, a pattern, and a use case that follows it:

```markdown
---
id: TL-LEND-CAP01
kind: capability
title: Membership
parent: TL-LEND
order: 1
---
Who may borrow: a librarian registers a person as a member.
```

```markdown
---
id: TL-PAT-LIBRARIAN-ACTION
kind: pattern
title: Librarian action
parent: TL
settings: record required_input result
---
A librarian at the desk enters a few details, and the library saves one record and shows what it saved.

## Settings

| Setting | What the use case decides |
| --- | --- |
| `record` | The record the action saves or changes. |
| `required_input` | What the librarian must enter for the action to go ahead. |
| `result` | What the library shows the librarian once the record is saved. |

## Rules

- When the librarian leaves out any of the `required_input`, the library MUST refuse the action, say what is missing, and save nothing.
```

```markdown
---
id: TL-LEND-UC01
kind: use_case
title: Register a member
parent: TL-LEND-CAP01
actor: Librarian
record: Member
required_input: The member's name and a valid email address.
result: The new member with their ID, which goes on their card.
links:
  applies: [TL-LEND-DR01]
  follows: [TL-PAT-LIBRARIAN-ACTION]
---
```

## Rules

- A requirement does not restate a domain rule; the use case `applies` the rule instead. Write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- A requirement says what, not how. Screens, routes and code belong to the design (see `design-the-domain`).
- A rule that only makes sense at one screen, endpoint or flow is an **interaction requirement** under that view, endpoint or flow, not a use case requirement. Examples: a field's type and limits, the status and error code of a refusal, what a success response returns, which button is disabled. Keep the use case requirement for what the actor must be able to do or must be refused ("an unavailable tool is refused with the reason"), and let the interaction requirement say how that shows at the endpoint ("POST /loans answers 409 `tool_on_loan`") and `fulfill` it. Test: if the rule names a route, a status code, a field limit or a screen element, it belongs in the design.
- Every use case needs at least one requirement; one with none is a warning.
- Something undecided is an open `question` with an `owner`, linked `about` the use case, never "TBD" in a requirement.
- Finish with the `check-and-fix` skill.
