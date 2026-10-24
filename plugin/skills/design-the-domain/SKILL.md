---
name: design-the-domain
description: Write or change a Lathe domain's design - flows, views, endpoints and components, and the links that trace them to requirements and domain rules. Use when designing screens, routes or code units for use cases in a repo with lathe.config.json.
---

# Design the domain

The design says how the product carries out its use cases: the paths people take (flows), the screens (views), the HTTP endpoints, and the units of code (components). Its links are what Lathe traces: a requirement or domain rule is **designed** when a component `satisfies` it.

## Before you write

1. Read the use cases and requirements being designed, and the domain rules they apply.
2. Read the domain's existing design records and take the next free number for each kind.

## The records and their links

| Kind | ID | Required fields | Links |
| --- | --- | --- | --- |
| `flow` | `<P>-<D>-F<nn>` | | `uses` views and endpoints; `fulfills` requirements |
| `view` | `<P>-<D>-V<nn>` | | `uses` endpoints; `fulfills` requirements |
| `endpoint` | `<P>-<D>-E<nn>` | `method`, `route` | `fulfills` requirements |
| `component` | `<P>-<D>-C<nn>` | `component_type` (model, service, router, ...), `file` (path from the repo root) | `satisfies` requirements and domain rules; `implements` endpoints and views; `depends_on` components |

Every design record's parent is the domain. Any link not in the meta-model's `relations.csv` is an error.

## Example

```markdown
---
id: TL-LEND-E04
kind: endpoint
title: Borrow a tool
parent: TL-LEND
method: POST
route: /loans
links:
  fulfills: [TL-LEND-UC03-R01, TL-LEND-UC03-R02]
---
Request: `{ "memberId": number, "toolId": number }`.

| Status | When | Body |
| --- | --- | --- |
| 201 | Lent. | The loan with `borrowedAt` and `dueAt`. |
| 409 `tool_on_loan` | The tool is on loan. | Error. |
```

```markdown
---
id: TL-LEND-C05
kind: component
title: lending-service.ts
parent: TL-LEND
component_type: service
file: src/lending-service.ts
links:
  satisfies: [TL-LEND-DR06, TL-LEND-UC03-R01, TL-LEND-UC03-R02]
  depends_on: [TL-LEND-C01]
---
Borrowing and returning. `borrow` runs the checks in the order the Borrow endpoint lists and creates a loan due 14 days later.
```

## Rules

- Link a component to the requirements and rules it actually enforces, not to everything it touches. A requirement no component satisfies is a warning (not designed).
- A component's `file` may not exist yet; that is a warning, and it clears when the code is written. Coverage counts it as **built** once the file exists.
- An endpoint's body lists every response, including each refusal and its code.
- Finish with the `check-and-fix` skill.
