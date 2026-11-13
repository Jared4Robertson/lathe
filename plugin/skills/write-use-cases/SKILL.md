---
name: write-use-cases
description: Write or change Lathe use cases - where each sits (its result's domain and aggregate or read model), each use case's actors, goal and result (the one command or query it invokes), its UC requirements, its one flow and the flow's steps (which fulfill the requirements, invoke a command or query, exchange with integrations and may be one interface's variant), the product's roles, and the patterns use cases share with their settings and rules. Use when adding what an actor does with the product, picking a use case's result, splitting a use case, writing how a use case is carried out step by step, moving a use case to another domain or result, naming or renaming a use case, or writing behavior several use cases share as a pattern, in a repo with lathe.config.json.
---

# Write use cases

A use case is one role invoking one command, or asking one query, its result: who acts, what they want, the rules the product must follow while they reach it, and its flow: the steps the actor and the product take to reach the result, once, whatever the interface. It names no aggregate or event; what it changes follows from its result. Each interface that offers it carries the same flow out its own way (`design-interfaces`). Write use cases after the domain model (`model-a-domain`), whose commands, queries and terms they use.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Before you write, read the domain's terms, commands and queries, its use cases by aggregate and read model (so you do not repeat one), and the product's patterns.

## Essential, not accidental

**Essential complexity** comes from the problem itself: the rules, distinctions and relationships any correct solution must capture, however it is built. **Accidental complexity** comes from the means used to build it: tools, structure and conventions the problem does not require, which other means could change or remove. What is accidental to one product is essential to another (TLS to a tool library, but not to a security product), and a platform is a product that takes on as essential what others want to stop deciding. A use case, its actors and its requirements are essential: ask of each whether a domain expert would recognize it and care. Leaks: a use case for a generic subdomain (sign in, reset a password) is provided by someone else, not written; a requirement that states how the product is built (a route, a table, a library) belongs in the technical specification; and rules repeated across use cases are a pattern in disguise.

## Where a use case sits

A use case belongs to a domain, and its domain and group follow from its result: it sits in its result's domain (`use-case-result-in-domain`), with its result's aggregate (a command use case) or its read model (a query use case). The group is worked out from the result and never stored, so there is nothing to choose, name or keep in step. Add a use case under its domain and pick its result from that domain's commands and queries; to put it elsewhere, Move a use case to another domain and a result there. Which business outcomes the use case is for comes from its aggregate or read model, which name the outcomes they serve (`discover-outcomes`). The working term for this grouping, where one is needed, is "use case group"; the UI shows each group by its aggregate's or read model's own title.

## Use cases

**A use case is one role invoking one command, or asking one query, with the steps that lead to it** (LA-STD-MODELING-R15). That operation is its **result** (`result_id`): a command makes it a **command use case**, a query a **query use case**. The kind follows from the result and is never stored. Pick the result first, from the domain model's commands and queries, then write the steps that lead to it. Which operation is the result is the one judgment left; everything else is checked:

- **Identity**: no two use cases of a product share their first actor and their result (`use-case-identity-taken`). Two that do are one use case: merge them. The same result with another first actor is another use case.
- **One command**: a command use case's flow invokes no command but its result, on any path (main, alternate, refused), through any interface, whoever the step's subject is; its other steps only ask queries or invoke nothing (`use-case-invokes-another-command`). A query use case invokes no command at all, and is anchored on its query, never on the read model, which serves several questions. A second command is a second use case, strung to the first in a journey when one waits on the other (`discover-outcomes`), or the command of a policy when the product does it on its own. Another actor's write is that actor's own use case.
- **Done**: through each interface that offers it, the main path invokes the result (`use-case-result-not-invoked`). A command use case may ask queries after its result, such as one confirming it; a query use case's last main step that invokes anything asks its result (`use-case-not-done`).
- **Title**: a command use case's title starts with its command's verb: Borrow a tool, for the command Borrow a tool (`use-case-title-off-result`). A query use case is titled for the question, with a verb of its own: See the tools waiting for repair. Two to six words, naming no interface or mechanism: "Approve an invoice", not "Approve an invoice from the web app".
- **Not a quality**: "Read without anything jumping" or "Work by keyboard" result in no operation. Write them as rules of a quality standard (`write-the-technical-spec`), never as use cases.
- **Shared rules**: requirements that hold only on some paths are two use cases; two use cases that differ only by an interface or a value are one (an interface offers it; a value is a rule of it).

The other half of identity: every command is the result of a use case whose actor invokes it, or the command of a policy when the product invokes it on its own; one that is neither is the gap `command-without-use-case`, so why each command exists is a record.

A use case's **goal** says who acts and what they want, and ends with one plain sentence of the value it gives that actor, why it matters to them, so a goal reads as more than mechanics. Mechanics only: "A member reserves a tool for a date." With the value: "A member reserves a tool for a date, so the tool is waiting when they come and nobody makes a wasted trip."

When a use case invokes a second command, split it: the use case keeps its ID and the command its title names, and each other command becomes a use case of its own in the same domain, with its steps, requirements and tests moved with what they prove, in one change.

**Actors are roles, never people.** A role is a part of the product (Member, Librarian; Owner, Reader, Agent in Lathe's own specs). Add a new role to the product with a description of what it does; write the same roles in prose.

**Journey steps.** When a journey has an unlinked step (`journey-step-unlinked`), it is a use case to write: write it, then link the step to it. A use case's "why" is its aggregate's or read model's outcomes and the journeys it is in (its page lists them as "In journeys"). A use case in no journey is fine; many stand alone.

## UC requirements

A UC requirement is one rule the use case must follow at the level of the actor's goal: what they must be able to do or must be refused, and what they are told.

- One rule per record, each testable on its own.
- It does not restate the domain model. An invariant, specification or constraint the use case's command keeps is already owed there; write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- It says what, not how. A rule that names a route, status code, field limit or screen element is a view or API requirement (`design-interfaces`).
- It holds whatever the interface: a step of its flow fulfills it. A rule only one interface can meet is a view or API requirement, or that interface's pattern rule, instead.
- Sort more than about 8 into groups (Validation, Errors), at least two each.

Every use case has at least one actor and one requirement, unless all its rules come from patterns.

## The flow

**One flow per use case, the same through every interface.** Write the steps once, in the people's words, as what the actor does and decides and what the product answers. Each interface's version of the flow is derived from the steps' commands and queries by the interface's pattern and shown, never written: a second flow for another interface is the same flow said again. Alternate courses (a refusal, an optional branch) are paths within the flow, beside the main path. Every UC requirement is fulfilled by a step of the flow; a requirement it misses is not designed. A step fulfills only requirements of its own use case.

**A step invokes at most one command or query**, never a route or a screen; one that only shows a result invokes nothing. A step whose actor reaches an outside system exchanges with that integration, naming it from the interface design stage (an integration is shared, so reuse one before adding it). That is one of the two references a use case's flow makes forward to interface design, deliberately.

**Step titles** say what the actor or the system does, in the present tense ("The member picks a tool"). They carry no text beyond the title; what a title cannot hold goes into a requirement the step fulfills. A step says what the actor does or learns, never how an interface does it (no command names, screens or tools).

**Variants are rare.** A step only one interface can do (opening the app from the Dock, a phone's sheet) names that interface, the other forward reference, and is in that interface's version alone. Before you mark one, ask whether the others do the same thing another way: then it is one step. Two steps that say one thing for two interfaces are one step; variants of two interfaces that invoke the same command or query are an error (`step-repeated-per-interface`). If only one interface can meet a rule (a disabled button, a status code), it is a view or API requirement, or that interface's pattern rule, instead.

A flow is titled as its use case ("Borrow a tool").

## Patterns

When two or more use cases would state the same rules, write those rules once as a pattern and let each follow it. A pattern is a fixed part, its settings and its slots. A setting is what each follower decides differently from a known set of ways, such as the record it saves; a pattern every follower applies the same way has no settings. A slot is where the variation is open-ended, so code written by hand fills it against a contract stated in one sentence (its statement); each such fill is accidental debt until the pattern can express it. Settings that grow conditions and loops are a language: add a slot or split the pattern instead. Wait for the third example before drawing a pattern; one drawn from fewer overfits.

- When a pattern applies to a whole domain, the domain follows it rather than each use case.
- A follower's requirements do not restate the pattern's rules.
- A pattern's rules hold for every follower. A rule that holds for only some is a UC requirement of those use cases, or another pattern.
- Every domain that follows a pattern owes each rule a pattern rule test (`plan-tests`).
- A rule about how code is written, which you follow and cite rather than prove through behavior, is a standard rule (`write-the-technical-spec`).

## Rules

- Titles: sentence case, no trailing period, unique within kind and product. A requirement or pattern rule is a sentence that is true when the rule holds ("An unavailable tool is refused with the reason").
- Something undecided is a question about the use case with an owner role, never "TBD" in a requirement.
- Next, design the interfaces that carry each flow out, with the views, endpoints and integrations its steps reach (`design-interfaces`), then finish with `check-and-fix`.
