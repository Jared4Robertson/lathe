---
name: design-the-domain
description: Write or change a Lathe domain's design - flows, views, endpoints, their interaction requirements, and components, with the links that trace them to requirements and domain rules. Use when designing screens, routes, request and response rules, or code units for use cases in a repo with lathe.config.json.
---

# Design the domain

The design says how the product carries out its use cases: the paths people take (flows), the screens (views), the HTTP endpoints, the rules each of those must follow (interaction requirements), and the units of code (components). Its links are what Lathe traces: an obligation (a requirement, domain rule or interaction requirement) is **designed** when a component `satisfies` it.

## Before you write

1. Read the use cases and requirements being designed, and the domain rules they apply.
2. Read the domain's existing design records and take the next free number for each kind.

## The records and their links

| Kind | ID | Required fields | Links |
| --- | --- | --- | --- |
| `flow` | `<P>-<D>-F<nn>` | | `uses` views and endpoints; `fulfills` requirements |
| `view` | `<P>-<D>-V<nn>` | | `uses` endpoints; `fulfills` requirements |
| `endpoint` | `<P>-<D>-E<nn>` | `method`, `route` | `fulfills` requirements |
| `interaction_requirement` | `<view, endpoint or flow>-R<nn>`, such as `TL-LEND-E04-R01` | | `fulfills` the use case requirements and domain rules it carries out at this view, endpoint or flow |
| `component` | `<P>-<D>-C<nn>` | `component_type` (model, service, router, ...), `file` (path from the repo root) | `satisfies` requirements, domain rules and interaction requirements; `implements` endpoints and views; `depends_on` components |

Every design record's parent is the domain, except an interaction requirement, whose parent is the view, endpoint or flow it constrains, and a flow, whose parent is the capability of the use cases it carries out when the domain has capabilities (see `write-use-cases`). Any link not in the meta-model's `relations.csv` is an error.

## Interaction requirements

An interaction requirement is one rule a view, endpoint or flow must follow: a field's type and limits, the status and error code of each refusal, what a success returns, what a screen shows or disables. Like a requirement, it is an obligation: Lathe counts it as designed, built, proved or planned, and warns while no component satisfies it or no test proves it.

- One rule per record. Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT / SHOULD / MAY.
- `fulfills` the use case requirement or domain rule it carries out here, so the trace runs from the use case down to the response. A rule with nothing above it (a field limit, say) needs no `fulfills`.
- Keep the endpoint's body as the overview (request shape, table of responses); state each rule that must be built and tested as an interaction requirement.
- Put the files next to their parent: `02-design/endpoints/E04-borrow-a-tool.md` and `02-design/endpoints/E04-borrow-a-tool/R01-tool-on-loan-is-409.md`.

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

An interaction requirement under the endpoint, carrying out a use case requirement and a domain rule:

```markdown
---
id: TL-LEND-E04-R01
kind: interaction_requirement
title: Borrowing a tool on loan answers 409 tool_on_loan
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R02, TL-LEND-DR06]
---
`POST /loans` for a tool that has an active loan MUST answer `409` with `{ "error": "tool_on_loan" }` and MUST NOT create a loan.
```

The component that enforces it adds it to its `satisfies` list (`satisfies: [..., TL-LEND-E04-R01]`), and a test `proves` it (see `plan-tests`).

## Rules

- Link a component to the requirements, rules and interaction requirements it actually enforces, not to everything it touches. An obligation no component satisfies is a warning (not designed).
- A component's `file` may not exist yet; that is a warning, and it clears when the code is written. Coverage counts it as **built** once the file exists.
- An endpoint's body lists every response, including each refusal and its code; each refusal that must be built and tested is also an interaction requirement.
- Finish with the `check-and-fix` skill.
