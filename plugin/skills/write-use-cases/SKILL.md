---
name: write-use-cases
description: Write or change Lathe use cases - the capabilities that group a domain's use cases, each use case's actors and goal, its UC requirements, the product's roles, and the patterns use cases share with their settings and rules. Use when adding what an actor does with the product, splitting a use case, grouping use cases into capabilities, naming or renaming a capability or use case, or writing behavior several use cases share as a pattern, in a repo with lathe.config.json.
---

# Write use cases

A use case is an actor's goal: who acts, what they want, and the rules the product must follow while they reach it. It changes nothing itself and names no aggregate or event; what it changes follows from the commands its flows' steps invoke. It happens through one or more interfaces, with one flow each (`design-interactions`). Write use cases after the domain model (`model-a-domain`), whose commands, queries and terms they use.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Before you write, read the domain's terms, commands and queries, its capabilities and use cases (so you do not repeat one), and the product's patterns.

## Essential, not accidental

**Essential complexity** comes from the problem itself: the rules, distinctions and relationships any correct solution must capture, however it is built. **Accidental complexity** comes from the means used to build it: tools, structure and conventions the problem does not require, which other means could change or remove. What is accidental to one product is essential to another (TLS to a tool library, but not to a security product), and a platform is a product that takes on as essential what others want to stop deciding. A use case, its actors and its requirements are essential: ask of each whether a domain expert would recognize it and care. Leaks: a use case for a generic subdomain (sign in, reset a password) is provided by someone else, not written; a requirement that states how the product is built (a route, a table, a library) belongs in the technical specification; and rules repeated across use cases are a pattern in disguise.

## Capabilities

Every use case sits in a capability: an ordered slice of its domain. Add the domain's capabilities first, then each use case under its capability. A capability with one use case, or none, is a gap; a capability that serves no business outcome is too (`discover-outcomes`).

**A capability is a noun phrase naming a lasting ability of the business**, two to four words. It says what, not how: no -ing start, no "The", no screen, tool or technology. It would still be true if the product were rebuilt on other technology. Good: Invoice management, Member registration, Lending. Not: Managing invoices, The payment screen, Lending through the web app, "Members, sign-up and profiles" (a list).

## Use cases

**A use case is one goal of one actor, reached in one sitting, verb first**, two to six words. One sitting is one session with no waiting on someone else. A goal that waits on another actor, or reads "... and later ...", is a journey (`discover-outcomes`): split it into use cases, and write a journey that carries them out in order. Use the domain's own verb (Borrow, Approve, Refund) over Create, Read, Update or Delete unless that really is the goal. Names no interface or mechanism: "Approve an invoice", not "Approve an invoice from the web app".

**When to split.** Split when:

- the title needs "and" or a list ("Register a member and send a welcome"): two goals;
- different actors want different things from the same operation, or the same actor starts from a different situation;
- the rules diverge: requirements that apply to only some paths are a sign of two use cases;
- the flows would share nothing beyond the command.

Merge when two use cases differ only by an interface (that is one use case offered through both) or by a value (that is a rule of one).

**Actors are roles, never people.** A role is a part of the product (Member, Librarian; Owner, Reader, Agent in Lathe's own specs). Add a new role to the product with a description of what it does; write the same roles in prose.

**Journey steps.** When a journey has an unlinked step (`journey-step-unlinked`), it is a use case to write: write it, then link the step to it. A use case's "why" is its capability's outcomes and the journeys it is in (its page lists them as "In journeys"). A use case in no journey is fine; many stand alone.

## UC requirements

A UC requirement is one rule the use case must follow at the level of the actor's goal: what they must be able to do or must be refused, and what they are told.

- One rule per record, each testable on its own.
- It does not restate the domain model. An invariant, specification or constraint the use case's command keeps is already owed there; write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- It says what, not how. A rule that names a route, status code, field limit or screen element is a view or API requirement (`design-interactions`).
- It holds whatever the interface: a step of its flow fulfills it. A rule only one interface can meet is a view or API requirement, or that interface's pattern rule, instead.
- Sort more than about 8 into groups (Validation, Errors), at least two each.

Every use case has at least one actor and one requirement, unless all its rules come from patterns.

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
- Next, write each use case's flow (`design-interactions`), then finish with `check-and-fix`.
