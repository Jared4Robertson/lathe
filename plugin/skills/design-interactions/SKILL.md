---
name: design-interactions
description: Write or change a Lathe product's interaction design - the product's interfaces (web app, API, CLI, agent tools, desktop), each use case's flows, one per interface it happens through, and their steps (which invoke a command or query, happen in a view, exchange with integrations and fulfill the use case's requirements), the views and their view requirements, the endpoints that expose commands and queries with their API requirements, and integrations. Use when designing how a use case is carried out, its screens, routes, request and response rules, or the outside systems it talks to, in a repo with lathe.config.json.
---

# Design interactions

The interaction design says how each use case is carried out through each interface it happens through. Write it after the domain model (`model-a-domain`) and the use cases (`write-use-cases`): a step links back to the command or query it invokes and the UC requirements it fulfills.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Before you write, read the use case with its requirements and flows, the commands and queries its steps will invoke, and the product's existing interfaces, views, integrations and endpoints: views and integrations are shared by every flow that uses them, so reuse before adding.

## Judgment

**Interfaces.** Declare each way the product is used once, under the product (web app, HTTP API, CLI, agent tools, desktop). An interface no flow goes through is not an interface yet. Mark it public only when people or programs outside the product build on it: a public API's requirements are its contract with the world, essential; an internal API's (the one only the product's own app calls) are accidental and belong in a pattern rule. Endpoints are always accidental, derived from the command or query they expose.

**One flow per interface a use case happens through.** Alternate courses (a refusal, an optional branch) are paths within a flow, never other flows. Every UC requirement is fulfilled by a step in every flow of its use case; a requirement one flow misses is not designed. If only one interface can meet a rule (a disabled button, a status code), it is a view or API requirement instead. A step says what happens in the people's words; the view it happens in is its link, so "On its page" and "click" are left out (`accidental-in-essential` warns), and a rule every page or command shares is the pattern's, not the step's.

**Steps fit their interface.** Web app and desktop steps happen in views. API steps invoke the command or query an endpoint exposes. CLI and agent tools steps invoke what the command or tool runs. A step invokes at most one command or query, and one that only shows a result invokes nothing. A step links to the operation, never to a route: the endpoint follows from it. A step fulfills only requirements of its own use case.

**Step titles** say what the actor or the system does, in the present tense ("The member picks a tool"). They carry no text beyond the title; what a title cannot hold goes into a requirement the step fulfills.

**Views** have no owner: a view exists because steps happen in it, and one view serves every flow whose steps happen there. A view requirement is one rule about this screen (what it shows while loading, a field's limits, which button is disabled). It does not restate a UC requirement: the step fulfills that; the view requirement says how it shows here and has its own test.

**Endpoints** expose exactly one command or query. Keep the description to the request and responses in brief; state every rule that must be built and tested as an API requirement (a body's shape, each refusal's status and error code, what success returns, a size limit). A rule shared by every endpoint, such as the shape of an error, is a pattern their use cases follow or a standard rule their handlers meet.

**Integrations** are outside systems the product exchanges with, named once and shared. One no step exchanges with is an error; its adapter is a technical record.

## Naming

A flow is its use case's title, "in" or "through", then its interface's title ("Borrow a tool through the HTTP API"). An endpoint is its method and route, nothing else. A view is its subject and form (Loan page, Return dialog). Interfaces and integrations take their proper names. A requirement is a sentence that is true when the rule holds ("An unknown loan answers 404 loan_not_found"). Sentence case, no trailing period, unique within kind and product.

## Rules

- A requirement of a view or endpoint says how a rule shows there; it never restates the UC requirement.
- Next, write the technical records (`write-the-technical-spec`), then finish with `check-and-fix`.
