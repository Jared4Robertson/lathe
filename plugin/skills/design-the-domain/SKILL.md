---
name: design-the-domain
description: Write or change a Lathe domain's design - flows, views, APIs and their endpoints, integrations, their interaction requirements, components and the layers that hold them, and technical flows, with the links that trace them to requirements and domain rules. Use when designing screens, routes, request and response rules, or code units for use cases in a repo with lathe.config.json.
---

# Design the domain

The design says how the product carries out its use cases: the paths people take (flows), the screens (views), the HTTP endpoints grouped by resource (APIs), the outside systems the domain exchanges with (integrations), the rules each of those must follow (interaction requirements), the units of code (components), and how the code carries out each flow (technical flows). Its links are what Lathe traces: an obligation (a requirement, domain rule or interaction requirement) is **designed** when a component, or a technical flow's step, `satisfies` it.

## Before you write

1. Read the use cases and requirements being designed, and the domain rules they apply. Read the aggregates' entities too (the `model-a-domain` skill): their fields and links are what models, stores and endpoint bodies carry.
2. Read the domain's existing design records and take the next free number for each kind.

## The records and their links

| Kind | ID | Required fields | Links |
| --- | --- | --- | --- |
| `flow` | `<P>-<D>-F<nn>` | | `carries_out` the use cases it walks through; `uses` views and endpoints; `fulfills` requirements, domain rules and interaction requirements (left to its steps once it has them) |
| `flow_step` | `<flow>-S<nn>`, such as `TL-LEND-F01-S01` | `order` (a whole number); optional `path`, such as `main`, `api` or `refused` | `uses` the view, endpoint or component the step goes through; `fulfills` the requirements, domain rules and interaction requirements the step carries out |
| `view` | `<P>-<D>-V<nn>` | | `uses` endpoints; `fulfills` requirements |
| `api` | `<P>-<D>-API<nn>` | | none; it holds the endpoints of one resource and the interaction requirements they all share |
| `endpoint` | `<P>-<D>-E<nn>` | `method`, `route` | `fulfills` requirements |
| `integration` | `<P>-<D>-INT<nn>` | optional `system`, the outside system's name | none; it holds one interaction requirement per exchange |
| `interaction_requirement` | `<view, endpoint, flow, API or integration>-R<nn>`, such as `TL-LEND-E04-R01`, or `<P>-<D>-IR<nn>` under the domain | | `fulfills` the use case requirements and domain rules it carries out at this view, endpoint, flow, API or integration |
| `layer` | `<P>-<D>-LAY<nn>` | `order` (a whole number, its place among the layers beside it, unique there) | none; it holds the domain's components, and may hold sub-layers |
| `component` | `<P>-<D>-C<nn>` | `component_type` (model, service, router, ...), `file` (path from the repo root) | `satisfies` requirements, domain rules and interaction requirements; `implements` endpoints and views; `depends_on` components |
| `design_flow` (technical flow) | `<P>-<D>-DF<nn>` | | `deepens` the flow it carries out |
| `design_step` (technical step) | `<technical flow>-S<nn>`, such as `TL-LEND-DF01-S01` | `order`; optional `path`, `transaction`, `locks`, `statements` | `uses` the component that does it; `satisfies` the obligations it designs |

Every design record's parent is the domain, except an endpoint, whose parent is the API for its resource, an interaction requirement, whose parent is the view, endpoint, flow, API or integration it constrains (or the domain, for a rule shared across its interaction design), a technical flow, whose parent is a layer when the domain has layers, a technical step, whose parent is its technical flow, a flow step, whose parent is its flow, a flow, whose parent is the capability of the use cases it carries out when the domain has capabilities (see `write-use-cases`), and a component, whose parent is its layer when the domain has layers (see below). Any link not in the meta-model's `relations.csv` is an error. Each relation reads by a label from either end, such as Satisfies and Designed by; `lathe format` lists every relation each kind may make and receive, with its labels.

## Layers

A domain's components go in **layers**: ordered groups by what the code is, such as 01 Models, 02 Accessors, 03 Services, 04 Connectors, 05 Routers and API app, 06 Web app, 07 Infrastructure and configuration. Each product names its own layers to fit its code; that set is only a starting point. See section 16 of `FORMAT.md`.

- Read the domain's layers before adding a component, and put it in the layer it belongs to. Add a layer only when no existing one fits.
- Keep each layer to about 15 components at most. Split a bigger one, for example by aggregate or capability, into layers with clear titles, or into sub-layers: layers whose parent is the bigger layer, each with its own order among them.
- Keep a layer's record at `02-design/components/<NN>-<slug>.md` and its components in the folder beside it, `02-design/components/<NN>-<slug>/`. Its body says in two or three sentences what the layer holds and where its code lives.
- Moving a component into a layer changes only its `parent`. Never change its ID.
- Once a domain has one layer, every component of the domain belongs in one; a component left under the domain is a `component-outside-layer` warning. A repeated or non-whole `order` is a `layer-order` error.
- A component in a layer still counts in its domain: coverage, owed pattern rules and flow steps treat it exactly as one directly under the domain.

## Interaction requirements

An interaction requirement is one rule a view, endpoint or flow must follow: a field's type and limits, the status and error code of each refusal, what a success returns, what a screen shows or disables. Like a requirement, it is an obligation: Lathe counts it as designed, built, proved or planned, and warns while no component satisfies it or no test proves it.

- One rule per record. Title: the rule in a few words. Body: the rule in full with MUST / MUST NOT / SHOULD / MAY.
- `fulfills` the use case requirement or domain rule it carries out here, so the trace runs from the use case down to the response. Even a rule that looks free-standing, such as a body size limit, protects something above it: link the requirement it serves. An interaction requirement that fulfills nothing is a warning (`interaction-requirement-fulfills-nothing`).
- Keep the endpoint's body as the overview (request shape, table of responses); state each rule that must be built and tested as an interaction requirement.
- Put the files next to their parent: `02-design/apis/API03-loans/E04-borrow-a-tool.md` and `02-design/apis/API03-loans/E04-borrow-a-tool/R01-tool-on-loan-is-409.md`.

## APIs and integrations

Group a domain's endpoints by resource (FORMAT.md section 20):

- One `api` per resource, such as Members, Tools or Loans, under the domain. Each endpoint's parent is its API. Moving an endpoint into an API changes only its `parent`, never its ID.
- A rule that holds for every endpoint of the API, such as how it pages or what an unknown ID answers, is an interaction requirement under the API, not a copy under each endpoint.
- The API's body may hold a `## Shapes` table of the request and response shapes its endpoints share.
- An outside system the domain exchanges with, such as a payment provider or a mail service, is an `integration` under the domain, with `system` naming it. Write each exchange as one interaction requirement under it.
- A rule shared across the whole domain's interaction design, belonging to no one endpoint, view or API, is an interaction requirement directly under the domain, numbered `<P>-<D>-IR<nn>`.

## Flow steps

Write a flow of more than a couple of steps as `flow_step` records, so traceability reads per step (FORMAT.md section 14):

- One record per step, under the flow: `order` gives its place (1, 2, 3, with no gaps; each step of a flow its own), the title says what happens in a few words, the body may say more.
- A flow with more than one path, such as an API path or a refused path beside the main one, gives each step a `path`. A step with no `path` is on the main path. Each path is numbered 1, 2, 3 on its own.
- `uses` names where the step happens (a view), what it calls (an endpoint), or the component that does it.
- `fulfills` names what this step carries out. Move each `fulfills` link from the flow onto the step that does it; the flow then needs none of its own.
- Put the files in a folder named after the flow: `02-design/flows/F01-borrow-and-return.md` and `02-design/flows/F01-borrow-and-return/S02-borrow-the-tool.md`.

```markdown
---
id: TL-LEND-F01-S02
kind: flow_step
title: The member borrows an available tool, or is told why not
parent: TL-LEND-F01
order: 2
links:
  uses: [TL-LEND-V01, TL-LEND-E04]
  fulfills: [TL-LEND-UC03-R02, TL-LEND-UC03-R03]
---
The member picks an available tool and borrows it (`POST /loans`). If the tool is not available, or the member cannot borrow, the catalog shows the reason.
```

What the checks say:

- `step-order` (error): an order that is not a whole number, two steps on one path of a flow with the same order (`1` and `01` clash), or a path whose numbering skips a number. Renumbering an order is fine; it is not an ID. The same check reads a technical flow's steps.
- `flow-step-fulfills-outside-flow` (warning): the step fulfills something that is not a requirement of a use case its flow `carries_out`, a domain rule one of them `applies`, or an interaction requirement reached from either or under the flow. Link it from a step of the right flow, or add the use case to this flow's `carries_out`.
- `flow-fulfills-differs-from-steps` (warning): the flow fulfills something none of its steps does. Move the link onto the step that carries it out.

## Technical flows

A flow says what a person sees; a technical flow says how the code carries it out (FORMAT.md section 21). Write one where the design is worth citing step by step, such as a flow whose steps run in a transaction, lock rows or call several components:

- One `design_flow` per flow it deepens, in the layer whose components do most of the work (or the domain), with `deepens` naming the flow. One that deepens nothing is a `design-flow-deepens-nothing` warning.
- One `design_step` per step, under it, ordered and with an optional `path`, as a flow's steps are. `uses` names the component that does the step; `satisfies` names the obligations the step designs, and counts as design, as a component's `satisfies` does. Only a component whose file exists counts as built.
- Give `transaction`, `locks` and `statements` when the step runs in a transaction, takes locks, or runs a known number of statements.
- Keep failure, limits and signals as tables in the technical flow's body.
- Put the files beside the layer's components: `02-design/components/03-services/DF01-borrow-a-tool.md` and `02-design/components/03-services/DF01-borrow-a-tool/S01-lock-the-tool.md`.

## Example

```markdown
---
id: TL-LEND-E04
kind: endpoint
title: Borrow a tool
parent: TL-LEND-API03
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
id: TL-LEND-LAY03
kind: layer
title: Services
parent: TL-LEND
order: 3
---
The lending rules, one service per aggregate, in `src/`.
```

```markdown
---
id: TL-LEND-C05
kind: component
title: lending-service.ts
parent: TL-LEND-LAY03
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
- Every component satisfies at least one obligation. One that satisfies none is a `component-satisfies-nothing` warning: link what it designs or implements, or remove it. There are no waivers; shared infrastructure (a server entry point, a store) links the requirements and rules it makes possible.
- A component's `file` may not exist yet; that is a warning, and it clears when the code is written. Coverage counts it as **built** once the file exists.
- An endpoint's body lists every response, including each refusal and its code; each refusal that must be built and tested is also an interaction requirement.
- Once a domain has a flow, every use case in it needs a flow that `carries_out` it (otherwise `use-case-without-flow`). One flow may carry out several use cases. A flow that only `fulfills` a use case's requirements does not carry out the use case.
- Tests link to design records too: a test `runs` a flow it walks end to end, and `covers` a component it exercises. Neither link counts as proof.
- Finish with the `check-and-fix` skill.
