---
name: design-interactions
description: Write or change a Lathe product's interaction design - each use case's one flow and its steps (which invoke a command or query, happen in a view, exchange with integrations and fulfill the use case's requirements), the views and their view requirements, the endpoints that expose commands and queries with their API requirements, and integrations. Use when designing how a use case is carried out, its screens, routes, request and response rules, or the outside systems it talks to, in a repo with lathe.config.json.
---

# Design interactions

The interaction design says how each use case is carried out: the steps a person or a client takes (the flow), the screens they happen in (views), the HTTP endpoints that expose the domain's commands and queries, the outside systems the product exchanges with (integrations), and the rules each view and endpoint must follow. Write it after the domain model (`model-a-domain`) and the use cases (`write-use-cases`): a step links back to the command or query it invokes and the UC requirements it fulfills.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means; the `link` tool's lists every relation with the kinds it joins. In a shell, `lathe add <table> --help` and `lathe add --help` print the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each new record's ID from `next_id`, with the record it will sit under as `parent`; for a view or an integration, which have no owner, give the product. IDs are never reused or renumbered.

## Before you write

1. `show` the use case and its UC requirements, and the commands and queries its steps will invoke, with their events and specifications.
2. `list` the product's views and integrations (`parent`: the product) and the domain's endpoints (`list` `endpoint` with a command or query as `parent`) before adding one: views and integrations are shared by every flow that uses them.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `flow` | its use case (exactly one) | `<use case>-FL` | `description`: how the use case is carried out. |
| `flow_step` | the flow | `<flow>-S<nn>` | `path` (such as `main` or `refused`), `position` on that path, from 1; `description`. Links: `invokes` at most one command or query, `happens_in` at most one view, `exchanges_with` integrations, `fulfills` UC requirements of its own use case. |
| `view` | none | `<P>-V<nn>` | A screen or page. `route`, `description`, `notes`. |
| `view_requirement` | the view | `<view>-R<nn>` | `statement`: one rule the view must follow. |
| `endpoint` | the command or query it exposes (exactly one) | `<P>-<D>-EP<nn>` | `method`, `route`, `description` (request and responses in brief), `notes`. |
| `api_requirement` | the endpoint | `<endpoint>-R<nn>` | `statement`: one rule the endpoint must follow. |
| `integration` | none | `<P>-INT<nn>` | An outside system, such as a mail service. `system`: its name; `description`. |

## Flows and steps

- **One flow per use case,** belonging only to it; `next_id` gives its one ID. Alternate courses are paths within the flow, not other flows.
- One `flow_step` per step. Its `path` and `position` place it: every path is numbered 1, 2, 3 on its own, and two steps in one place are refused. A flow with one course gives every step `path: "main"`; a refusal or an alternate course is its own path, such as `refused`.
- A step `invokes` at most one command or query: the domain operation it carries out. A step that only shows a result invokes nothing. Steps reach endpoints through their command or query, never directly.
- A step `happens_in` at most one view, and `exchanges_with` each integration it talks to.
- A step `fulfills` the UC requirements it carries out, and only requirements of its own use case (the store refuses another's). Every UC requirement needs at least one step that fulfills it; one that has none is a gap.

## Views and view requirements

- A view has no owner: it exists because steps happen in it, and one view serves every flow whose steps happen there. Its product is the one its ID starts with. A view no step happens in is an error.
- A view requirement is one rule the view must follow, such as what it shows while loading, a field's limits, or which button is disabled. A view test proves it (see `plan-tests`).

## Endpoints and API requirements

- An endpoint exposes exactly one command or query: give exactly one of `command_id` and `query_id`. Its ID is numbered across the domain. Move it to another command or query of its domain with `move`.
- Keep the endpoint's `description` to the request and responses in brief. State each rule that must be built and tested as an API requirement under it: a body's shape, the status and error code of each refusal, what a success returns, a size limit. An endpoint test proves it.
- A rule shared by every endpoint, such as the shape of an error, is either a pattern (see `write-use-cases`) or an API requirement on the endpoint that motivated it, saying it holds for all.

## Integrations

An outside system the product exchanges with is an `integration`, with `system` naming it. It has no owner: it exists because steps exchange with it. An integration no step exchanges with is an error. Its adapter is a technical record (see `write-the-technical-spec`), and integration tests prove the exchange.

## Example: the Tool Library

The Return a tool flow: the librarian opens the Return desk, records the return (which invokes the command), a refused return, and the result:

```
add  { "flow": { "id": "TL-LEND-UC04-FL", "title": "Return a tool", "use_case_id": "TL-LEND-UC04",
       "description": "How a librarian takes a tool back and closes its loan." } }
add  { "view": { "id": "TL-V02", "title": "Return desk", "description": "The librarian's page for returns and repairs." } }
add  { "flow_step": { "id": "TL-LEND-UC04-FL-S02", "title": "The librarian records the condition and, optionally, a note",
       "flow_id": "TL-LEND-UC04-FL", "path": "main", "position": 2 } }
link { "source": "TL-LEND-UC04-FL-S02", "relation": "invokes", "target": "TL-LEND-CMD06" }
link { "source": "TL-LEND-UC04-FL-S02", "relation": "happens_in", "target": "TL-V02" }
add  { "flow_step": { "id": "TL-LEND-UC04-FL-S03", "title": "A return with no valid condition, of an unknown loan or of a loan already returned is refused",
       "flow_id": "TL-LEND-UC04-FL", "path": "refused", "position": 1 } }
link { "source": "TL-LEND-UC04-FL-S03", "relation": "happens_in", "target": "TL-V02" }
link { "source": "TL-LEND-UC04-FL-S03", "relation": "fulfills", "target": "TL-LEND-UC04-R01" }
```

The endpoint that exposes the command, and one of its API requirements:

```
add  { "endpoint": { "id": "TL-LEND-EP05", "title": "Return a tool", "command_id": "TL-LEND-CMD06",
       "method": "POST", "route": "/loans/{loanId}/return",
       "description": "Request: { \"condition\": \"good\" | \"needs_repair\", \"note\"?: string }. Responds 200 with the loan, or 400 / 404 / 409 with an error." } }
add  { "api_requirement": { "id": "TL-LEND-EP05-R02", "title": "An unknown loan answers 404 loan_not_found", "endpoint_id": "TL-LEND-EP05",
       "statement": "Returning a loan that does not exist MUST answer 404 with { \"error\": \"loan_not_found\" } and change nothing." } }
```

A step that sends a reminder through an outside system:

```
add  { "integration": { "id": "TL-INT01", "title": "Mail", "system": "The library's mail service",
       "description": "Sends members their due-date reminders." } }
link { "source": "TL-LEND-UC03-FL-S04", "relation": "exchanges_with", "target": "TL-INT01" }
```

## Rules

- A view or API requirement does not restate a UC requirement: it says how the rule shows here (a status code, a message, a disabled button). The UC requirement is fulfilled by the step; the view or API requirement is proved by its own test.
- A step's description may name the route it calls, but the link is to the command or query: the endpoint follows from it.
- Next, write the technical records that implement the design with the `write-the-technical-spec` skill, then finish with `check-and-fix`.
