---
name: design-the-domain
description: Write or change a Lathe domain's design - flows, views, APIs and their endpoints, integrations, their interaction requirements, components and the layers that hold them, and technical flows, with the links that trace them to requirements and domain rules. Use when designing screens, routes, request and response rules, or code units for use cases in a repo with lathe.config.json.
---

# Design the domain

The design says how the product carries out its use cases: the paths people take (flows), the screens (views), the HTTP endpoints grouped by resource (APIs), the outside systems the domain exchanges with (integrations), the rules each of those must follow (interaction requirements), the units of code (components), and how the code carries out each flow (technical flows). Its links are what Lathe traces: an obligation (a requirement, domain rule or interaction requirement) is **designed** when a component, or a technical flow's step, `satisfies` it.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means; the `link` tool's lists every relation with the kinds it joins. In a shell, `lathe add <table> --help` and `lathe add --help` print the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- A design record names its domain (`domain_id`) and, when it sits in a container, that container's column too (`layer_id`, `api_id`, `capability_id`, ...). Or add it under the domain and `move` it into the container.
- Take each new record's ID from `next_id`. IDs are never reused or renumbered.

## Before you write

1. `show` the use cases and requirements being designed, and the domain rules they apply. `show` the aggregates' entities too (the `model-a-domain` skill): their fields and links are what models, stores and endpoint bodies carry.
2. `list` the domain's existing design records of each kind (`parent`: the domain) before adding one.

## The records and their links

| Kind | ID | Columns | Links |
| --- | --- | --- | --- |
| `flow` | `<P>-<D>-F<nn>` | `description`; `capability_id` when the domain has capabilities | `carries_out` the use cases it walks through; `uses` views and endpoints; `fulfills` requirements, domain rules and interaction requirements (left to its steps once it has them) |
| `flow_step` | `<flow>-S<nn>`, such as `TL-LEND-F01-S01` | `flow_id`, `path` (such as `main`, `api` or `refused`), `position`, `description` | `uses` the view, endpoint or component the step goes through; `fulfills` what the step carries out |
| `view` | `<P>-<D>-V<nn>` | `route`, `description`, `notes` | `uses` endpoints; `fulfills` requirements |
| `api` | `<P>-<D>-API<nn>` | `description`; its shared request and response shapes are `api_shape` rows (`position`, `name`, `meaning`, `fields`) | none; it holds the endpoints of one resource and the interaction requirements they all share |
| `endpoint` | `<P>-<D>-E<nn>` | `api_id`, `method`, `route`, `description` (request and responses in brief), `notes` (the full table of responses) | `fulfills` requirements |
| `integration` | `<P>-<D>-INT<nn>` | `system`, the outside system's name; `description` | none; it holds one interaction requirement per exchange |
| `interaction_requirement` | `<view, endpoint, flow, API or integration>-R<nn>`, such as `TL-LEND-E04-R01`, or `<P>-<D>-IR<nn>` under the domain | `statement`; the one container column (`view_id`, `endpoint_id`, `flow_id`, `api_id` or `integration_id`), or none under the domain; `group_name` once there are more than about 8 | `fulfills` the use case requirements and domain rules it carries out here |
| `layer` | `<P>-<D>-LAY<nn>` | `position` (its place among the layers beside it, unique there), `parent_layer_id` for a sub-layer, `description` | none; it holds the domain's components, and may hold sub-layers |
| `component` | `<P>-<D>-C<nn>` | `layer_id`, `component_type` (model, service, router, ...), `file` (path from the repo root), `description` | `satisfies` requirements, domain rules and interaction requirements; `implements` endpoints and views; `depends_on` components; `meets` the standard rules it follows (see Standards) |
| `design_flow` (technical flow) | `<P>-<D>-DF<nn>` | `layer_id`, `description`, `notes` | `deepens` the flow it carries out |
| `design_step` (technical step) | `<technical flow>-S<nn>`, such as `TL-LEND-DF01-S01` | `design_flow_id`, `path`, `position`, `description`, `transaction_name`, `locks`, `statements` | `uses` the component that does it; `satisfies` the obligations it designs; `meets` standard rules it follows |

Every design record sits in its domain, except: an endpoint sits in the API for its resource; an interaction requirement in the view, endpoint, flow, API or integration it constrains (or the domain, for a rule shared across its interaction design); a technical flow in a layer when the domain has layers; a step in its flow or technical flow; a flow in the capability of the use cases it carries out when the domain has capabilities (see `write-use-cases`); and a component in its layer when the domain has layers (see below). A link between kinds its relation does not join is refused. Each relation reads by a label from either end, such as Satisfies and Designed by; `show` prints a record's links by their labels.

## Layers

A domain's components go in **layers**: ordered groups by what the code is, such as 01 Models, 02 Accessors, 03 Services, 04 Connectors, 05 Routers and API app, 06 Web app, 07 Infrastructure and configuration. Each product names its own layers to fit its code; that set is only a starting point.

- `list` the domain's layers before adding a component, and put it in the layer it belongs to. Add a layer only when no existing one fits.
- Keep each layer to about 15 components at most. Split a bigger one, for example by aggregate or capability, into layers with clear titles, or into sub-layers: layers whose `parent_layer_id` is the bigger layer, each with its own `position` among them.
- A layer's `description` says in two or three sentences what it holds and where its code lives.
- Put a component into a layer with `move` (`parent`: the layer). Its ID never changes.
- Once a domain has one layer, every component of the domain belongs in one; a component left under the domain is a `component-outside-layer` warning. Two layers in one place with the same `position` are refused.
- A component in a layer still counts in its domain: coverage, owed pattern rules and flow steps treat it exactly as one directly under the domain.

## Standards

A product's engineering rules for its code, such as logging, error handling or naming, live in **standards** at product level, beside the patterns: a `standard` record under the product (ID `<P>-STD-<NAME>`, such as `TL-STD-CODE`) and its `standard_rule` records under it (`<standard>-R<nn>`, such as `TL-STD-CODE-R01`), one rule each in `statement` with MUST / MUST NOT / SHOULD / MAY, and a `group_name` once a standard has more than about 8.

- A component, a technical step or a test that follows a rule says so with a `meets` link to it (read from the rule as Met by). It does not count as design or proof: a standard rule is not an obligation and no domain owes it.
- Write only rules the code really follows. A rule that nothing meets is a `standard-rule-unmet` warning: link what follows it, or remove it.
- A rule you prove with tests is a pattern rule (see `write-use-cases`); a rule you follow and cite is a standard rule.

## Interaction requirements

An interaction requirement is one rule a view, endpoint or flow must follow: a field's type and limits, the status and error code of each refusal, what a success returns, what a screen shows or disables. Like a requirement, it is an obligation: Lathe counts it as designed, built, proved or planned, and warns while no component satisfies it or no test proves it.

- One rule per record. Title: the rule in a few words. `statement`: the rule in full with MUST / MUST NOT / SHOULD / MAY.
- Link it with `fulfills` to the use case requirement or domain rule it carries out here, so the trace runs from the use case down to the response. Even a rule that looks free-standing, such as a body size limit, protects something above it: link the requirement it serves. One that fulfills nothing is an `interaction-requirement-fulfills-nothing` warning.
- Keep the endpoint's `description` and `notes` as the overview (request shape, table of responses); state each rule that must be built and tested as an interaction requirement.

## APIs and integrations

Group a domain's endpoints by resource:

- One `api` per resource, such as Members, Tools or Loans, under the domain. Each endpoint sits in its API (`api_id`). Put an endpoint into an API with `move`; its ID never changes.
- A rule that holds for every endpoint of the API, such as how it pages or what an unknown ID answers, is an interaction requirement under the API, not a copy under each endpoint.
- The request and response shapes an API's endpoints share are its `api_shape` rows.
- An outside system the domain exchanges with, such as a payment provider or a mail service, is an `integration` under the domain, with `system` naming it. Write each exchange as one interaction requirement under it.
- A rule shared across the whole domain's interaction design, belonging to no one endpoint, view or API, is an interaction requirement directly under the domain, numbered `<P>-<D>-IR<nn>` (`next_id` with the domain as parent gives it).

## Flow steps

Write a flow of more than a couple of steps as `flow_step` records, so traceability reads per step:

- One record per step, under the flow: `path` and `position` give its place (each path numbered 1, 2, 3 on its own, with no gaps; two steps in one place are refused), the title says what happens in a few words, `description` may say more.
- A flow with one path gives every step `path: main`. A flow with more, such as an API path or a refused path beside the main one, names each.
- `uses` names where the step happens (a view), what it calls (an endpoint), or the component that does it.
- `fulfills` names what this step carries out. Move each `fulfills` link from the flow onto the step that does it (`unlink` it from the flow, `link` it from the step); the flow then needs none of its own.

```
add  { "flow_step": { "id": "TL-LEND-F01-S02", "title": "The member borrows an available tool, or is told why not",
       "flow_id": "TL-LEND-F01", "path": "main", "position": 2,
       "description": "The member picks an available tool and borrows it (POST /loans). If the tool is not available, or the member cannot borrow, the catalog shows the reason." } }
link { "source": "TL-LEND-F01-S02", "relation": "uses", "target": "TL-LEND-V01" }
link { "source": "TL-LEND-F01-S02", "relation": "uses", "target": "TL-LEND-E04" }
link { "source": "TL-LEND-F01-S02", "relation": "fulfills", "target": "TL-LEND-UC03-R02" }
```

What the checks say:

- A path whose numbering skips a number is a `step-order` error; renumbering a `position` is fine, it is not an ID. The same check reads a technical flow's steps.
- `flow-step-fulfills-outside-flow` (warning): the step fulfills something that is not a requirement of a use case its flow `carries_out`, a domain rule one of them `applies`, or an interaction requirement reached from either or under the flow. Link it from a step of the right flow, or link the use case from this flow with `carries_out`.
- `flow-fulfills-differs-from-steps` (warning): the flow fulfills something none of its steps does. Move the link onto the step that carries it out.

## Technical flows

A flow says what a person sees; a technical flow says how the code carries it out. Write one where the design is worth citing step by step, such as a flow whose steps run in a transaction, lock rows or call several components:

- One `design_flow` per flow it deepens, in the layer whose components do most of the work (or the domain), with a `deepens` link to the flow. One that deepens nothing is a `design-flow-deepens-nothing` warning.
- One `design_step` per step, under it, with a `path` and `position` as a flow's steps have. `uses` names the component that does the step; `satisfies` names the obligations the step designs, and counts as design, as a component's `satisfies` does. Only a component whose file exists counts as built.
- Give `transaction_name`, `locks` and `statements` when the step runs in a transaction, takes locks, or runs a known number of statements.
- Keep failure, limits and signals as tables in the technical flow's `notes`.

## Example

An endpoint in its API, a layer, a component in it, and an interaction requirement under the endpoint that carries out a use case requirement and a domain rule:

```
add  { "endpoint": { "id": "TL-LEND-E04", "title": "Borrow a tool", "domain_id": "TL-LEND", "api_id": "TL-LEND-API03",
       "method": "POST", "route": "/loans",
       "description": "Takes { memberId, toolId }; answers 201 with the loan, or 409 tool_on_loan.",
       "notes": "| Status | When | Body |\n| --- | --- | --- |\n| 201 | Lent. | The loan with borrowedAt and dueAt. |\n| 409 tool_on_loan | The tool is on loan. | Error. |" } }
link { "source": "TL-LEND-E04", "relation": "fulfills", "target": "TL-LEND-UC03-R02" }

add  { "layer": { "id": "TL-LEND-LAY03", "title": "Services", "domain_id": "TL-LEND", "position": 3,
       "description": "The lending rules, one service per aggregate, in src/." } }

add  { "component": { "id": "TL-LEND-C05", "title": "lending-service.ts", "domain_id": "TL-LEND", "layer_id": "TL-LEND-LAY03",
       "component_type": "service", "file": "src/lending-service.ts",
       "description": "Borrowing and returning: borrow runs the checks in the order the Borrow endpoint lists and creates a loan due 14 days later." } }
link { "source": "TL-LEND-C05", "relation": "satisfies", "target": "TL-LEND-DR06" }
link { "source": "TL-LEND-C05", "relation": "satisfies", "target": "TL-LEND-UC03-R02" }
link { "source": "TL-LEND-C05", "relation": "implements", "target": "TL-LEND-E04" }
link { "source": "TL-LEND-C05", "relation": "depends_on", "target": "TL-LEND-C01" }

add  { "interaction_requirement": { "id": "TL-LEND-E04-R01", "title": "Borrowing a tool on loan answers 409 tool_on_loan",
       "domain_id": "TL-LEND", "endpoint_id": "TL-LEND-E04",
       "statement": "POST /loans for a tool that has an active loan MUST answer 409 with { \"error\": \"tool_on_loan\" } and MUST NOT create a loan." } }
link { "source": "TL-LEND-E04-R01", "relation": "fulfills", "target": "TL-LEND-UC03-R02" }
link { "source": "TL-LEND-E04-R01", "relation": "fulfills", "target": "TL-LEND-DR06" }
link { "source": "TL-LEND-C05", "relation": "satisfies", "target": "TL-LEND-E04-R01" }
```

A test then `proves` the interaction requirement (see `plan-tests`).

## Rules

- Link a component to the requirements, rules and interaction requirements it actually enforces, not to everything it touches. An obligation no component satisfies is an `unsatisfied` warning (not designed).
- Every component satisfies at least one obligation. One that satisfies none is a `component-satisfies-nothing` warning: link what it designs or implements, or remove it. No component is waived; shared infrastructure (a server entry point, a store) links the requirements and rules it makes possible.
- A component's `file` may not exist yet; that is a warning, and it clears when the code is written. Coverage counts it as **built** once the file exists.
- An endpoint's notes list every response, including each refusal and its code; each refusal that must be built and tested is also an interaction requirement.
- Once a domain has a flow, every use case in it needs a flow that `carries_out` it (otherwise `use-case-without-flow`). One flow may carry out several use cases. A flow that only `fulfills` a use case's requirements does not carry out the use case.
- Tests link to design records too: a test `runs` a flow it walks end to end, and `covers` a component it exercises. Neither link counts as proof.
- Finish with the `check-and-fix` skill.
