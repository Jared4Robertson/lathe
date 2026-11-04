---
name: design-interfaces
description: Write or change a Lathe product's interface design - the product's interfaces (web app, API, CLI, agent tools, desktop) with the roles that use them, the use cases they offer and the patterns they follow, so every interface that offers a use case reaches each step of its flow; the views that present commands and queries and their view requirements, the endpoints that expose commands and queries with their API requirements, and integrations with the use cases they perform on their own. Use when deciding where and through what a use case's flow is carried out, its screens, routes, request and response rules, or the outside systems its steps talk to, in a repo with lathe.config.json.
---

# Design interfaces

The interface design says what each interface needs to carry out the flows of the use cases it offers. It starts from each use case's flow, which the use cases stage already holds, written once whatever the interface (`write-use-cases`): its steps fulfill the use case's requirements and invoke commands and queries of the domain model (`model-a-domain`). Here you decide the interfaces, and the views, endpoints and integrations that reach those steps.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Before you write, read the use case with its requirements and its flow, the commands and queries its steps invoke, and the product's existing interfaces, views, integrations and endpoints: views and integrations are shared by every flow that uses them, so reuse before adding.

## Judgment

**Interfaces.** Declare each way the product is used once, under the product (web app, HTTP API, CLI, agent tools, desktop), with the roles that use it and the use cases it offers. An interface that offers no use case is not an interface yet. Each interface follows the pattern that says how a step is carried out through it (the view, call or tool, and how a refusal shows): write that once, as the pattern's rules, never in a step, and prove each rule once per domain. Mark it public only when people or programs outside the product build on it: a public API's requirements are its contract with the world, essential; an internal API's (the one only the product's own app calls) are accidental and belong in a pattern rule. Endpoints are always accidental, derived from the command or query they expose.

**Each interface's version of a flow is derived, never written.** The interface's pattern turns the flow's steps, through their commands and queries, into that interface's version, shown on the use case's page and in the Trace. Do not write a flow, or a step, for an interface: if an interface needs a step the others do not, it is a variant, which the flow names (`write-use-cases`). If only one interface can meet a rule (a disabled button, a status code), it is a view or API requirement, or that interface's pattern rule.

**Every offering interface reaches each step.** Each interface that offers the use case must reach what each step invokes: a web app or desktop through a view that presents it, an API through the endpoint that exposes it, a CLI or agent tools through the product's own command or tool for it: a record of its own interface design kind under the command or query, or one that presents it, as a view does, when one invocation carries out several (one that sits under an interface reaches only that one; `step-unreached` warns). Where an interface cannot, give it the means, make the step another interface's variant in the flow, or stop offering the use case there.

**What, not how.** What a person needs to see and decide, and in what order, is essential: it belongs in the flow's step and the view's requirements. How a screen is laid out, styled or wired is accidental: it belongs in the interface's pattern, written once, or is derived. A view requirement that mixes the two is split: keep the what, move the how.

**Views** have no owner: a view exists because it presents commands and queries, a person sending or asking each there, and a step that invokes one is carried out in it on a web app or desktop. A view only one interface shows (the desktop's Dock icon) names it. A view requirement is one rule about this screen (what it shows while loading, a field's limits, which button is disabled). It does not restate a UC requirement: the step fulfills that; the view requirement says how it shows here and has its own test.

**Endpoints** expose exactly one command or query. Keep the description to the request and responses in brief; state every rule that must be built and tested as an API requirement (a body's shape, each refusal's status and error code, what success returns, a size limit). A rule shared by every endpoint, such as the shape of an error, is a pattern their use cases follow or a standard rule their handlers meet.

**Integrations** are outside systems the product exchanges with, named once and shared: a flow's step exchanges with one from the use cases stage, the one link besides a variant's interface that reaches forward into this stage. One no step or policy exchanges with is an error; its adapter is a technical record. A policy that reaches an outside system as it acts, such as mailing a reminder, names that integration too (`exchanges_with` on Add or Change a policy), and the adapter builds the policy with its event handler.

**An integration may perform a use case.** When an outside system carries a use case out on its own, with no person and no interface of the product (a build service that publishes a release when a tag is pushed), do not invent an interface for it. Have the integration perform the use case (`performs` on Add or Change an integration) and have each step that happens there exchange with it. Such a use case needs no interface to offer it (`flow-not-offered` is satisfied), and a step that exchanges with the performing integration is reached whatever the interface (`step-unreached` leaves it be). A use case that a person also starts through an interface is offered by that interface as well.

## Naming

An endpoint is its method and route, nothing else. A view is its subject and form (Loan page, Return dialog). Interfaces and integrations take their proper names. A requirement is a sentence that is true when the rule holds ("An unknown loan answers 404 loan_not_found"). Sentence case, no trailing period, unique within kind and product.

## Rules

- A requirement of a view or endpoint says how a rule shows there; it never restates the UC requirement.
- Next, write the technical records (`write-the-technical-spec`), then finish with `check-and-fix`.
