---
name: model-a-domain
description: Split a product into domains by business capability, then write or change a Lathe domain model in event storming order - aggregates, entities, commands and events, then invariants, value objects, specifications, policies, read models, domain services, storage requirements and terms. Also the order of the whole spec, from the business outcomes to the tests, and how to retire prose specs into records. Use when deciding a product's domains, adding or changing any domain model record, or moving an existing prose spec into Lathe, in a repo with lathe.config.json.
---

# Model a domain

A domain model says what the product's records are, what may change them, what that change announces, and what must always be true of them, whoever asks. It has no actors, screens or code. Every record has exactly one parent: what the tree already says is never stored twice.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. A refused command changed nothing and lists every reason; fix the input and try again. The tools, kinds, fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Take every ID from the aggregate's next-ID tool; never reuse or renumber one.

## Step one: find the slices

Before you write any record, find the product's business capabilities and make each one a domain: a vertical slice that owns its domain model, use cases, flows, endpoints, technical records and tests. A domain is what DDD calls a bounded context: one model, one language and one owner. Technology is never a domain: it shows in the technical records that implement each design record. What every domain shares, such as sign-in, goes in a generic domain or a pattern.

Ask of each candidate domain:

- Would a person who uses the product name it, in their own words? Lending is; the frontend is not.
- Does it have its own terms, records and rules, which its glossary can hold?
- Would it still exist if the product were rebuilt on other technology? A capability would; a layer would not.
- Can one use case be specified, built and proved inside it, from command to screen to test, without another domain designing the same thing again?
- Is it named for what it does for someone, rather than where its code runs (web app, API, server, database, desktop, mobile, engine)?

A candidate that fails these is a layer or a platform concern, not a domain. Give each domain its subdomain type: core for the product's edge, supporting for what the core needs, generic for what is solved the same way everywhere. It guides how much modeling the domain deserves. Give each domain its position among the product's domains, from 1: the order the nav, the product page and the graph list them in. Put them in the order the Owner reads the product (for a stage-by-stage product, the stages in order), and change a position with `change-domain`.

## The order of the whole spec

Write a product stage by stage, so each record's links point at records written before it; the one deliberate exception is a flow step naming the interface of a variant or an integration it exchanges with, both written in interface design. Each stage has its skill.

1. **Discovery** (`discover-outcomes`): business outcomes, each measurable, and the journeys that reach them.
2. **Domain model** (this skill), in event storming order: aggregates with entities and fields; commands and the events they raise; then invariants, value objects and constraints, specifications, policies, read models and queries, domain services, storage requirements, terms.
3. **Use cases** (`write-use-cases`): use cases with actors, results and UC requirements, each use case's flow and its steps, shared patterns. A use case is written after the command or query that is its result.
4. **Interface design** (`design-interfaces`): interfaces, views, endpoints, integrations.
5. **Technical specification** (`write-the-technical-spec`): one technical record per design record, tables, standards.
6. **Test plan** (`plan-tests`): one test kind per thing tested.

Finish each stage with `check-and-fix`. Gaps a later stage owes are reported, not errors, because records are written stage by stage.

## Tests of judgment

**Aggregate.** It is what one command changes as a unit, in one transaction, keeping all its invariants. Start from the records that must change together; anything with a life of its own is the root of another aggregate. Keep aggregates small: a root and a few children that live and die with it. Aggregates refer to each other by ID only.

**One aggregate per command.** When something must also change in another aggregate, the model is wrong, not the rule. Either the two are really one aggregate (they must never be seen apart), or the first command raises an event and a policy sends the second aggregate's command. Never let a command change two.

**Events.** An event says what happened, in the past tense, and carries what changed, not the whole entity. Publish it only when other domains may hear it: domains meet only through published events. An event a policy hears is delivered by outbox, since a lost reaction is a lost change.

**Sorting a rule.** Ask what the rule is about:

- A value's own format, checked when the value is created: a *constraint* of a value object (make the value object if the field has none).
- Something true of one aggregate after every change, including uniqueness across its records: an *invariant*.
- A named yes-or-no predicate over aggregates of one domain that commands check or queries select by: a *specification*.
- "Whenever this happened, then do that", often in another aggregate: a *policy*. A policy that reaches an outside system as it acts, such as a mail service, names the integration it exchanges with. A journey's handoff step carries out a policy; a handoff the journey needs with no policy to carry it out is how missing policies are found (`discover-outcomes`).
- Logic that belongs to no single entity and is not a yes-or-no check, such as a due date: a *domain service* (it uses no storage and no outside system).
- A rule that needs an actor or a screen is not a domain rule: it is a UC requirement, view requirement or API requirement.

**Essential, in the domain's words.** **Essential complexity** comes from the problem itself: the rules, distinctions and relationships any correct solution must capture, however it is built. **Accidental complexity** comes from the means used to build it: tools, structure and conventions the problem does not require, which other means could change or remove. What is accidental to one product is essential to another (TLS to a tool library, but not to a security product), and a platform is a product that takes on as essential what others want to stop deciding.

A domain model is essential complexity. Record-level test: would a domain expert recognize this record and care? Three leaks to avoid: a generic subdomain modeled as if it were the product's own (logging in, tenancy, notifications; someone else solves it, so it is provided); a technology-shaped model (aggregates shaped like tables, Create/Update/Delete commands, flags that exist for the database); and a workflow-shaped model (commands that mirror screens or steps rather than what the business does). It names no table, row, column, page, endpoint, JSON, technical kind or interface of the product (`accidental-in-essential` warns of one), unless the word is a term of the domain's own glossary: a domain about specs may have a term Table; a generic subdomain someone else owns, such as logging in, is provided rather than modeled (`name-provider`). Record-level test: would a domain expert recognize it and care?

**Worked-out values** (a count of active loans, an overdue flag) are not fields of an entity; they are specifications or read model fields.

**Terms.** Each word of the domain's language is a term with its meaning here; use it exactly in titles, statements and code. Definitions build up and never in a circle: define a term only with plain words and terms below it, and link the terms its meaning uses. When two terms would name each other, say the lower one in plain words.

**Names.** A command is the domain's own imperative verb and object (Borrow a tool), never Create, Update or Delete over "a record". An event is a past participle phrase, subject first (Tool borrowed). A policy starts with "When". An invariant or constraint is a sentence true when the rule holds. A statement is one rule in one or two sentences, with MUST or MUST NOT.

**One repository per aggregate.** Code that loads and saves several aggregates the same way, such as a generic store, is split into one repository per aggregate.

**Questions.** Something undecided is a question under the product or domain, with an owner role and the records it is about. Never write "TBD" into a rule. Once decided, remove the question and write the answer into the records it affects. Records carry no status or history; git holds the history.

## Retiring prose specs into records

A product that already has specs in prose (markdown requirements, design documents) moves them into records and then deletes the prose, so one source remains.

1. **Sort before you copy.** Read each prose document and assign every rule to a record kind by the tests above. Do not copy whole sections into one description; one rule per record.
2. **Keep the reasoning, not the document.** Rationale belongs in the record's own text, a standard rule or a decision, written for the record. Do not cite the prose by file or commit; a citation to a retired document is a dead link.
3. **Work by domain.** Move one domain at a time, in the order above, and delete that domain's prose in the same change that completes it, so the prose and the records never both hold the rule.
4. **Undecided prose becomes a question.** "Not written yet", TBD and open points become questions with owners, not empty records.
5. **Final sweep.** When the last document is gone, search the whole repo (code comments, tests, READMEs, scripts, CI, other docs) for the retired files' names, section numbers and paths, and replace each hit with the record's ID or remove it. Then run `check-and-fix` and confirm no rule exists only in prose.

## Rules

- One rule per record. Use the domain's terms exactly.
- Specs name roles (Owner, Reader, Agent, or the product's own, such as Librarian), never people.
- Finish with `check-and-fix`. New obligations show as gaps until a technical record implements each and a test proves it; that is expected.
