# Lathe: Working Notes

Running notes from conversations, starting at the lowest fidelity: what are we even trying to do?

## Session 1 (2026-10-21)

### What we're trying to do
- "SDLC RSI" = recursive self-improvement applied to the software development lifecycle: a development process that improves itself.
- Who it's for: me, AI agents, and my teammates, and possibly other people more broadly later.
- What it is: a general-purpose set of tools, frameworks, and ways of thinking for people to adopt (not a single app).

### Glossary
The definitions and relationships now live as data in [model/terms.csv](model/terms.csv) and [model/links.csv](model/links.csv); see [model/README.md](model/README.md). Edit them there, not here. The reasoning behind each decision stays in these notes.

### Domain model (DDD framing, draft)
- Glossary definitions accepted as drafts.
- Bounded context being defined: the foundational "people and tools" context (name TBD).
- Proposed aggregates: **Person** and **Tool**.
- **Software** and **Lathe** probably belong outside this context: they are specific kinds of Tool and likely belong in a downstream "making software" context.
- Where the remaining terms might fit (to discuss):
  - **Value:** a value object; a judgment that a particular person holds about something.
  - **Purpose:** a value object on Tool (what the tool is for), and possibly on Person too (the goals they hold).
  - **Experience:** ~~involves a giver and a receiver~~. Revised: every experience is unique to the person having it, so experiences aren't literally given or received. Experience belongs inside the **Person** aggregate.
  - What actually passes between people is something one person *does* that leads to an experience in another: an **Action** (added to the glossary).
  - **Action (recommended): a domain event raised by whoever acted** (a Person, or a Tool acting on a Person's behalf), not its own aggregate. It records who or what acted, what they did, which Tool was involved, if any, and whose behalf it was on.
    - Other Person aggregates react to the event and each forms its *own* Experience. The actor can't control how anyone else experiences their action, which matches the idea that every experience is unique to the person having it.
    - Revisit if actions turn out to need their own lifecycle (planned → in progress → done) or several co-actors; then Action would become its own aggregate.
- DDD building blocks and where our terms sit so far:
  | Kind | What it is | Our terms |
  |---|---|---|
  | Aggregate | A cluster of things with its own identity and rules, changed as one unit | Person, Tool |
  | Entity | A thing with identity that lives inside an aggregate | Experience (inside Person) |
  | Value object | A description with no identity of its own; defined only by its contents | Value, Purpose, Condition and Fitness (inside Tool) |
  | Domain event | An unchangeable record that something happened; named in the past tense | Action (e.g. "PersonActed"), Occurrence |
- Where events come from:
  - Within the domain, an event is always raised by an aggregate, when something it is responsible for changes. Usually something prompts it (a request, another event, time passing), but the aggregate decides and records what happened.
  - Events can also arrive from outside this context (another bounded context, or the world itself: a clock ticking, the weather). They're usually translated into our own terms at the boundary.
  - Implication: not every Experience comes from a person's Action. Some come from things that just happen (rain, a tool breaking).
  - **Decided: include these** in the context, while treating Actions as the main focus (they're what people and tools can influence).
  - **Decided: things that just happen are called Occurrences.** (Considered Happening and Circumstance; avoided "Event" because it clashes with the DDD term "domain event".)
  - So an Experience can be prompted by an Action (someone did something) or an Occurrence (something happened).
- Tools acting on their own (thermostat, scheduled job, AI agent): is that an Action or an Occurrence?
  - **Decided: the dividing line is purpose.** An Action has a purpose behind it; an Occurrence doesn't.
    - A tool doing what it was set up to do (a thermostat turning on the heat) → an **Action**, taken on behalf of the person whose purpose it serves.
    - A tool failing or doing something nobody intended (a pipe bursting) → an **Occurrence**.
  - Action's glossary definition changed from "something a person does" to "something done on purpose, by a Person directly or by a Tool on a Person's behalf". Occurrence's definition was updated to match.
  - Every tool action then traces back to a person, which gives accountability. It also matters for AI agents, which are tools that act on their own a lot.
  - Open: how a Tool's action records whose behalf it acts on.
- Actions (and Occurrences) can affect Tools too, not just People: sharpening a knife, configuring a thermostat, fixing a bug, a tool wearing out.
  - Tools don't have experiences, so the effect on a Tool is a **change in its condition**: what it can do and how well.
  - Same pattern as Person: the Tool aggregate reacts to the event and updates its *own* condition. Nothing outside reaches in and changes it directly.
  - **Decided: new term Condition** (value object inside Tool). Considered State and Capability.
  - Does Condition overlap with Purpose? **Agreed: they're separate but linked:**
    - **Purpose** = what the tool is *for*; the intended outcome, set by the person it serves. Stays fairly stable. (A knife is for cutting food.)
    - **Condition** = what the tool can actually do *right now*. Changes with use, wear and improvement. (This knife is dull.)
    - The **gap between them** is how well the tool serves its purpose. Improving a tool = closing that gap.
  - **Decided: the gap is called Fitness** (from "fitness for purpose"; it also echoes fitness in evolution, where better-fitting things survive and improve).
    - ~~Lives in the Person aggregate~~. **Revised: Fitness lives in the Tool aggregate, assigned by the Person it serves**, the same way Purpose is. Purpose, Condition and Fitness then sit side by side in Tool.
    - It's still a judgment that belongs to a person: assigning it is an **Action** by that Person, which the Tool reacts to by updating its Fitness. A tool never assigns its own fitness.
    - The evidence for that judgment is the person's **Experiences** of using the tool.
    - So the full loop is: an Action changes a Tool's Condition → the person it serves has Experiences using it → they act to assign the Tool a new Fitness.
    - Caveat: this works cleanly while a Tool serves one Person. If a tool serves many people, each would assign their own Fitness, and Tool would hold one per person. Revisit then.
    - **Implication for Lathe:** a tool can't improve itself in a vacuum. Self-improvement needs a feedback loop from the Experiences of the people it serves.
  - This is the heart of Lathe: improving a tool is an Action whose effect is a better Condition, and a Tool acting on a Tool (a lathe making a better lathe) is recursive self-improvement.
- Revised foundation statement (draft 2): People want to have positive experiences, and to act in ways that lead to positive experiences for others and for themselves.

### First principles (starting simpler)
- **Foundation statement (draft):** People want to give and receive positive experiences, to and from other people, including themselves.
- The ladder, from the foundation down (each level answers "why?" for the one below it):
  1. People: want to give and receive positive experiences.
  2. Value: some outcomes are better than others because they create those experiences.
  3. Purpose: goals are the outcomes people pursue.
  4. Tool: extends what a person can do toward a goal.
  5. Software: a tool that writes know-how down so a machine can repeat it.
  6. Lathe: a tool for making software that also improves itself.
- Decided to stop at the people level; going further up becomes philosophy.
- Q: What is the purpose of a tool? (Software is one kind of tool.)
  - Candidate answer: a tool extends what someone can do. It turns their intent into an outcome with less effort, more reliability, or more reach than they'd have without it.
  - A tool has no purpose by itself; its value is measured by the outcome for the person using it.
  - Good tools tend to disappear into the work (you think about the nail, not the hammer).
- Q: What is the point of software?
  - Agreed: software is a way to get something useful done for people, by writing the know-how down once so a machine can do it reliably and repeatedly, and cheaply at scale.

### Open questions
- If Lathe improves itself, who or what decides what "better" means?

### Decisions
- **Project name: Lathe.** A lathe is a machine tool that can make parts for other machines, including another lathe ("the mother of machine tools"). Like a lathe, this project is a tool-making tool that improves itself. (Previously called "SDLC RSI".)
- **AI agents are Tools, for now.** An agent acts on purpose, but on a Person's behalf, so its work counts as Actions taken for that person. Could be revisited if agents ever need to be treated as having their own experiences.
- **Person has Goals; Tool has a Purpose.** Purpose used to sit in both aggregates, which made links to it ambiguous ("Action sets Purpose": whose?). Now a Goal is an outcome a person wants, and a Purpose is what a tool is for, set by the person it serves. A check in model/checks.sql now stops any part from sitting in more than one aggregate.

## Session 2 (2026-10-24): Lathe as a structured spec store

### What Lathe is for
- Organise a product's lifecycle the way S2_sandbox's `docs/` does (domain model, use cases, interaction design, technical spec, test plan), but as **structured records** that a database checks and a web app navigates. S2 already behaves like a database written in Markdown (IDs, fixed table columns, regex layout checks, a trace generator); Lathe makes that explicit.
- **Dogfood it:** Lathe's own spec lives in Lathe.
- **Keep an example product** alongside, so the model stays concrete: the Tool Library (members borrow tools; a tool's condition decides whether it can be lent). It deliberately echoes the people-and-tools foundation.

### Decisions
- **Two apps per product.** Building a product with Lathe means two things: the product itself (its own code, tests, deployment), and a Lathe instance (engine and browser) pointed at that product's specs. The spec IDs are the link: the product's tests carry them, and Lathe checks that they do. For now both live in this repo (`specs/`, `examples/`); later the specs would live in the product's own repo, as S2's `docs/` does.
- **Files stay the source of truth; DuckDB is the engine.** One Markdown file per record, with a YAML header for its fields and links (see `lathe/FORMAT.md`). The engine rebuilds an in-memory DuckDB from the files on every load, so git review, diffs and agent edits keep working.
- **The rules are data.** Kinds of record and the relations allowed between them live in `lathe/meta/kinds.csv` and `lathe/meta/relations.csv`, built from the SDLC Brainstorm tree and S2's structure. Each check is its own SQL file in `lathe/checks/`. Changing a rule is a recorded, checked change, which is the self-improvement hook.
- **Errors versus warnings.** Errors mean the workspace is broken (bad IDs, parents or links; a test whose code does not carry its ID). Warnings mean work is still to do (a requirement no component satisfies or no test proves). Coverage per domain is S2's "design complete" check, as a query.
- The CSV diagrams under `model/` stay as they are for now: they're brainstorm canvases. How they relate to spec records is an open question.

## Session 3 (2026-10-24): settling the open questions

Jared asked for every recommendation to be applied, so these were decided on his behalf with the recommended option. Each answer now lives in the records it affects; the question records are removed.

| Question | Decision |
| --- | --- |
| LA-Q01 How is Fitness measured? | Both: Jared records his judgment as `fitness` records (date, score 1 to 5, the experiences behind it); coverage, open questions and checks are shown as evidence beside it, never as the score. Lathe never writes a fitness record. |
| LA-Q02 When do specs move into product repos? | Already done by packaging: each product keeps its specs in its own repo with `lathe.config.json`; one Lathe instance reads one repo; the meta-model travels with the package as defaults plus product extensions. Lathe's repo keeps Lathe's spec and the Tool Library example. |
| LA-Q03 Package name | `@jaredrob/lathe`. Publishing waits until the format settles and needs Jared's approval. |
| LA-Q04 CI action or plugin first? | The Claude Code plugin first. |
| LA-MOD-Q01 Diagrams and records | Separate: CSV diagrams are brainstorm canvases; a specified domain is drawn from its records (the Graph tab). No merge. |
| LA-MOD-Q02 Status on records | No status field. A record in the specs is in force, uncertainty is an open question, git keeps history (FORMAT.md section 8). |
| LA-CHK-Q01 Edit the meta-model in the app | No. It changes in files, reviewed like records. |
| LA-CHK-Q02 Do planned components count? | Report designed, built and proved separately. |
| LA-CHK-Q03 Check the meta-model? | Yes, with error checks for consistency. |
| LA-BRW-Q01 Read-only browser? | Yes: spec pages stay read-only; records change in files and are reviewed in git. |
| TL-LEND-Q01 Damage reported during a loan | Kept: a good return does not clear it; a librarian marks it repaired. |
| TL-LEND-Q02 Overdue grace | Overdue by calendar day in the library's time zone (default America/New_York): due at the end of the due date. No override. |

## Session 4 (2026-10-24): S2 parity and the app shell

### Decisions (Jared's requests, or decided on his instruction to apply the recommended option)
| Topic | Decision |
| --- | --- |
| Coverage | Driven by the meta-model: kinds marked `obligation`, relations with a `design` or `proof` role. Counted per domain and obligation kind: designed, built, proved, planned. |
| Interaction requirements | A default kind under views, endpoints and flows, for API and screen rules (about a third of a mature product's rules). |
| Tests | A state (automated, manual, planned); an automated test's file names its own ID or the IDs it proves; planned tests show intent but are never proof. |
| Extensions | A product's meta-model rows add kinds and relations, or widen default kinds; duplicates within one folder are errors. |
| Capabilities and patterns | From S2: ordered capabilities group a domain's use cases, flows and tests; patterns state shared behaviour once with settings that following use cases fill in. |
| LA-CHK-Q10 Proving pattern rules | Pattern rules are records (`pattern_rule`) and obligations of every domain that follows the pattern (through any of its use cases); proof counts where the test sits. A rule tied to a setting does not apply in a domain whose following use cases all mark that setting Not applicable. |
| App shell | One address per record or group, with Wiki, Graph and Split views; a collapsible nav with quick find; a collapsible inspector (the "third column"); one level deeper by default with folded lists; VS Code-style shortcuts. The Graph item left the nav: the graph is a view of every page. |
| Logo | The chuck in a chuck; the simple chuck is the favicon. |
