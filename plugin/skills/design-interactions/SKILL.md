---
name: design-interactions
description: Write or change a Lathe product's interaction design - the product's interfaces (web app, API, CLI, agent tools, desktop) with the roles that use them, the use cases they offer and the patterns they follow, each use case's one flow and its steps (which invoke a command or query, exchange with integrations, fulfill the use case's requirements and may be one interface's variant), the views that present commands and queries and their view requirements, the endpoints that expose commands and queries with their API requirements, and integrations. Use when designing how a use case is carried out, its screens, routes, request and response rules, or the outside systems it talks to, in a repo with lathe.config.json.
---

# Design interactions

The interaction design says how each use case is carried out, once, whatever the interface, and what each interface needs to carry it out. Write it after the domain model (`model-a-domain`) and the use cases (`write-use-cases`): a step links back to the command or query it invokes and the UC requirements it fulfills.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Before you write, read the use case with its requirements and flows, the commands and queries its steps will invoke, and the product's existing interfaces, views, integrations and endpoints: views and integrations are shared by every flow that uses them, so reuse before adding.

## Judgment

**Interfaces.** Declare each way the product is used once, under the product (web app, HTTP API, CLI, agent tools, desktop), with the roles that use it and the use cases it offers. An interface that offers no use case is not an interface yet. Each interface follows the pattern that says how a step is carried out through it (the view, call or tool, and how a refusal shows): write that once, as the pattern's rules, never in a step, and prove each rule once per domain. Mark it public only when people or programs outside the product build on it: a public API's requirements are its contract with the world, essential; an internal API's (the one only the product's own app calls) are accidental and belong in a pattern rule. Endpoints are always accidental, derived from the command or query they expose.

**One flow per use case, the same through every interface.** Write the steps once, in the people's words, as what they do and decide. Each interface's version of the flow is derived from the steps' commands and queries by the interface's pattern and shown, never written: a second flow for another interface is the same flow said again. Alternate courses (a refusal, an optional branch) are paths within the flow. Every UC requirement is fulfilled by a step of the flow; a requirement it misses is not designed. If only one interface can meet a rule (a disabled button, a status code), it is a view or API requirement, or that interface's pattern rule, instead.

**Variants are rare.** A step only one interface can do (opening the app from the Dock, a phone's sheet) names that interface; it is in that interface's version alone. Before you mark one, ask whether the others do the same thing another way: then it is one step. Two steps that say one thing for two interfaces are one step; variants of two interfaces that invoke the same command or query are an error (`step-repeated-per-interface`).

**Every offering interface reaches each step.** A step invokes at most one command or query, never a route or a screen, and one that only shows a result invokes nothing. Each interface that offers the use case must reach what it invokes: a web app or desktop through a view that presents it, an API through the endpoint that exposes it, a CLI or agent tools through the product's own command or tool for it: a record of its own interaction design kind under the command or query, or one that presents it, as a view does, when one invocation carries out several (one that sits under an interface reaches only that one; `step-unreached` warns). Where an interface cannot, give it the means, make the step another interface's variant, or stop offering the use case there. A step fulfills only requirements of its own use case.

**Step titles** say what the actor or the system does, in the present tense ("The member picks a tool"). They carry no text beyond the title; what a title cannot hold goes into a requirement the step fulfills.

**What, not how.** What a person needs to see and decide, and in what order, is essential: it belongs in the step and the view's requirements. How a screen is laid out, styled or wired is accidental: it belongs in the interface's pattern, written once, or is derived. A view requirement that mixes the two is split: keep the what, move the how.

**Views** have no owner: a view exists because it presents commands and queries, a person sending or asking each there, and a step that invokes one is carried out in it on a web app or desktop. A view only one interface shows (the desktop's Dock icon) names it. A view requirement is one rule about this screen (what it shows while loading, a field's limits, which button is disabled). It does not restate a UC requirement: the step fulfills that; the view requirement says how it shows here and has its own test.

**Endpoints** expose exactly one command or query. Keep the description to the request and responses in brief; state every rule that must be built and tested as an API requirement (a body's shape, each refusal's status and error code, what success returns, a size limit). A rule shared by every endpoint, such as the shape of an error, is a pattern their use cases follow or a standard rule their handlers meet.

**Integrations** are outside systems the product exchanges with, named once and shared. One no step or policy exchanges with is an error; its adapter is a technical record. A policy that reaches an outside system as it acts, such as mailing a reminder, names that integration too (`exchanges_with` on Add or Change a policy), and the adapter builds the policy with its event handler.

## Naming

A flow is titled as its use case ("Borrow a tool"). An endpoint is its method and route, nothing else. A view is its subject and form (Loan page, Return dialog). Interfaces and integrations take their proper names. A requirement is a sentence that is true when the rule holds ("An unknown loan answers 404 loan_not_found"). Sentence case, no trailing period, unique within kind and product.

## Rules

- A requirement of a view or endpoint says how a rule shows there; it never restates the UC requirement.
- Next, write the technical records (`write-the-technical-spec`), then finish with `check-and-fix`.
