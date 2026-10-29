---
name: model-a-domain
description: Split a product into domains by business capability, then write or change a Lathe domain model in event storming order - aggregates, their entities and fields, the commands that change them and the events they raise, then invariants, value objects and their constraints, specifications, policies, read models and queries, domain services and the domain's terms. Also the order of the whole spec, from the business outcomes to the tests. Use when deciding a product's domains, or adding or changing any domain model record, in a repo with lathe.config.json.
---

# Model a domain

A domain model says what the product's records are, what may change them, what that change announces, and what must always be true of them, whoever asks. It has no actors, screens or code. Lathe's model is drawn from domain-driven design, CQRS and event storming, and every record has exactly one parent: what can be worked out from the tree is never stored twice.

## Step one: find the slices

Before you write any record, find the product's business capabilities and make each one a domain: a vertical slice that owns its domain model, use cases, flows, endpoints, technical records and tests. A domain is what DDD calls a bounded context: one model, one language and one owner. Technology is never a domain: it shows in the technical records that implement each design record (see `write-the-technical-spec`). What every domain shares, such as sign-in, goes in a generic domain or a pattern.

Ask of each candidate domain:

- Would a person who uses the product name it, in their own words? Lending is; the frontend is not.
- Does it have its own terms, records and rules, which its glossary can hold?
- Would it still exist if the product were rebuilt on other technology? A capability would; a layer would not.
- Can one use case be specified, built and proved inside it, from command to screen to test, without another domain designing the same thing again?
- Is it named for what it does for someone, rather than where its code runs (web app, API, server, database, desktop, mobile, engine)?

A candidate that fails these is a layer or a platform concern, not a domain. Give each domain its `subdomain_type`: `core` for the product's edge, `supporting` for what the core needs but is not its edge, `generic` for what is solved the same way everywhere. It guides how much modeling the domain deserves.

Like a domain, each capability inside it (a slice that groups its use cases, written with `write-use-cases`) is named for what it does, as a noun phrase for a lasting ability of the business, such as Invoice management, Member registration or Lending, never an -ing phrase ("Managing invoices"), "The ..." or a screen, tool or technology. Its use cases are named for one goal of their actor, verb first, such as Borrow a tool or Approve an invoice, never for an interface ("Approve an invoice from the web app"). `write-use-cases` has both conventions with examples, and the `title-breaks-convention` check warns of the parts it can read.

## Principles

Lathe follows four principles (`LA-STD-PRINCIPLES`), and so does a model written with it:
- **Mistakes are refused, not found:** a rule that can be enforced when something is written is enforced then.
- **One way to do each thing:** add a second way only when a real need shows the first cannot serve it.
- **Deviations are deliberate and visible:** record a deliberate deviation with its reason, where checks list it.
- **Change the standard, not the instance:** when the standard way proves wrong, change it everywhere at once, and remove what no longer serves a purpose.

## The order of the whole spec

Write a product stage by stage, in this order, so that each record's links point at records written before it. Each stage has its skill.

1. **Discovery** (`discover-outcomes`): the product's business outcomes, each measurable, which its capabilities will serve.
2. **Domain model** (this skill), in event storming order: aggregates with their entities and fields; commands and the events they raise; then invariants, value objects and their constraints, specifications, policies, read models and queries, domain services and terms.
3. **Use cases** (`write-use-cases`): capabilities, each linked to the outcomes it serves, use cases with their actors, and their UC requirements; patterns they share.
4. **Interaction design** (`design-interactions`): the product's interfaces, each use case's flows (one per interface it happens through) and their steps, which invoke the commands and queries and fulfill the UC requirements; the views, endpoints and integrations the steps reach, with their view and API requirements.
5. **Technical specification** (`write-the-technical-spec`): one technical record for each design record it implements, tables and their keys, standards.
6. **Test plan** (`plan-tests`): one test kind per thing tested, each with its run by, and the test data sets tests start from.

Finish each stage with `check-and-fix`. The checks report what a later stage still owes (a command no step invokes, an obligation with no test) as gaps, not errors, because records are written stage by stage.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means; the `link` tool's lists every relation with the kinds it joins. In a shell, `lathe add <table> --help` and `lathe add --help` print the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- A record is a row of its kind's table: `id`, `title`, the one column naming its parent (`domain_id`, `aggregate_id`, ...), then its own columns. Value objects and specifications have no parent column: their product, or a specification's domain, is the one their ID starts with.
- Take each new record's ID from `next_id`, with the record it will sit under as `parent`; for a value object give the product, for a specification its domain. Domain model IDs are numbered across the domain (`TL-LEND-CMD05`), whatever aggregate they sit under. IDs are never reused or renumbered.

## Before you write

1. `show` the product and the domain, and `list` each domain model kind with the domain or the aggregate as `parent`, so a new record does not repeat an old one.
2. `list` the domain's terms (`term`, `parent`: the domain) and use them exactly.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `domain` | the product | `<P>-<D>` | `subdomain_type`; `description`: what it covers. |
| `aggregate` | the domain | `<P>-<D>-A<n>` | The consistency boundary, named for its root. `identity`: what tells two apart in the business. |
| `entity` | an aggregate | `<P>-<D>-EN<nn>` | A record with an identity. `role`: `root` (exactly one per aggregate) or `child`; `in_root_table: true` for a child stored in its root's table. Its fields are `entity_field` rows. |
| `command` | an aggregate | `<P>-<D>-CMD<nn>` | A request to change that one aggregate, named as an imperative (Borrow a tool). Links: `raises` events, `checks` specifications, `calls` domain services. |
| `domain_event` | an aggregate | `<P>-<D>-EV<nn>` | Something that happened, in the past tense (Loan opened). `published`: whether other domains may hear it. Its fields are `event_field` rows. |
| `invariant` | an aggregate | `<P>-<D>-INV<nn>` | `statement`: what holds for that aggregate on every change. |
| `value_object` | none | `<P>-VO<nn>` | A value with no identity, such as an email address. Its fields are `value_object_field` rows when it has more than one part. |
| `constraint` | a value object | `<value object>-C<nn>` | `statement`: the value object's own rule, checked when a value is created. |
| `specification` | none | `<P>-<D>-SP<nn>` | `statement`: a named yes-or-no predicate. Links: `reads` the aggregates it reads, all of its domain. |
| `policy` | the command it invokes | `<P>-<D>-PO<nn>` | `statement`: whenever an event, then this command. Link: `hears` its one event. |
| `read_model` | the domain | `<P>-<D>-RM<nn>` | A view of the domain's data shaped for reading. Its fields are `read_model_field` rows. Link: `reads` the aggregates it reads. |
| `query` | a read model | `<P>-<D>-QRY<nn>` | A question asked of that read model; it changes nothing. Links: `selects_by` specifications, `calls` domain services. |
| `domain_service` | the domain | `<P>-<D>-DS<nn>` | `statement`: domain logic that belongs to no single entity and is not a yes-or-no check, such as a due date or a late fee. |
| `term` | the domain | `<P>-<D>-TM<nn>` | The word as `title`, and `meaning`: what it means in this domain. |

Every `statement` is one rule in one sentence or two, with MUST / MUST NOT where it is a rule.

## Naming

Every record's `title` follows one convention, whatever its kind: sentence case, no trailing period, and unique within its kind and product. The store refuses a duplicate title or a trailing period. Names take 1 to 4 words, goals 2 to 6, statements one short sentence (about 15 words); detail goes in the `statement` or `description`, never the title.

| Kind | Title | Good | Not |
| --- | --- | --- | --- |
| domain | a noun for a business area | Lending | Loan management screens |
| aggregate, entity, value object, term, read model | a singular noun phrase, no article | Loan, Email address, Loan history | The loans |
| domain service | a noun phrase for what it works out | Due date | Calculate due date |
| command | an imperative verb and its object | Borrow a tool | Tool borrowing |
| query | Get, List or Find and its object | List overdue loans | Overdue loans |
| domain event | a past participle phrase, subject first | Tool borrowed | Borrow tool |
| policy | "When" the event, then the reaction | When a tool is returned damaged, hold it for repair | Damage policy |
| invariant, constraint | a sentence that is true when the rule holds | A loan has one borrower | Loan borrower rule |
| specification | a yes-or-no condition, no article | Tool is available | The tool is available |

`lathe check` warns of a query that does not start with Get, List or Find, a specification that starts with A, An or The, and a domain event not in the past tense (`event-tense`). Capabilities and use cases are named in `write-use-cases`.

## 1. Aggregates and entities

- An aggregate is what one command changes as a unit, in one transaction, keeping all its invariants. Start from the records that must change together and stay consistent; anything with a life of its own is the root of another aggregate.
- Each aggregate has one `root` entity, named as the aggregate is. Add a `child` only for a part that lives and dies with the root, such as a return of a loan, and link it from the root, or from the child it is part of, with `has_one` or `has_many`.
- A child stored in its root's table, as its columns, has `in_root_table: true` and no table of its own.
- One `entity_field` row per field, in `position` order, each name once. A field's type is exactly one of: `type`, a basic type (`text`, `whole number`, `decimal`, `date`, `time`, `date and time`, `yes/no`); `type_value_object_id`, a value object; or `type_aggregate_id`, a reference to another aggregate by its ID. `required` says whether every record gives it a value. `column_name` names its column when that differs from the field's name, such as `id` for a Loan ID. `example` gives one real-looking value.
- Aggregates refer to each other by ID only: a Loan's Member is a field typed by the Member aggregate, never a `has_one`. A reference to an aggregate of the same domain becomes a foreign key; one to another domain's stays a plain ID.
- **One repository per aggregate.** Each aggregate is loaded and saved whole by its own repository, a technical record (`write-the-technical-spec`) linked to it with `persists`, and each repository persists exactly one aggregate. It sits under its aggregate's domain, or, when several domains share it, under the domain that holds what they share, such as Platform. An aggregate no repository persists is a coverage gap (`aggregate-without-repository`); a second repository for an aggregate, or a second aggregate for a repository, is refused; a repository that persists none is an error.
- **A recorded exception: one generic store.** When one piece of code truly persists several aggregates the same way, such as a generic store over uniform rows, where a repository per aggregate would only pass calls through, keep one repository persisting one aggregate and add a `repository_share` row to it for each other aggregate it persists, with the `reason`. The store refuses an aggregate a repository already persists; `lathe check` lists every share under Recorded exceptions (never as a warning), and coverage counts its aggregate as persisted. Prefer a repository per aggregate.
- Leave out fields that are worked out, such as a count of active loans or an overdue flag: they are specifications or read model fields, since a table's columns follow from its entity's fields.

## 2. Commands and events

- **One aggregate per command.** A command changes exactly one aggregate, its parent. When something must follow in another aggregate, raise an event and let a policy send that aggregate's command: the change follows through the event.
- **Small aggregates.** An aggregate is the smallest cluster that must stay consistent after one command: most need a root and a few children. The check warns of an aggregate with more entities than the product's `max_entities_per_aggregate` setting (`product_setting`, 7 by default): split it into smaller aggregates that each change together, and keep a rule that spans two as a specification the command checks, or follow it through an event and a policy. Do not raise the setting to silence the warning unless the user asks.
- **A recorded exception.** When a change to another aggregate of the same domain truly cannot follow through an event, because the two must never be seen apart, add a `command_change` row to the command with that aggregate and the `reason`. The store refuses the command's own aggregate and another domain's; `lathe check` lists every exception in its Recorded exceptions section (never as a warning), so each stays visible and deliberate. Prefer the event and the policy.
- A command `raises` each event it may raise, of its own aggregate. An event no command raises is a gap.
- Name an event in the past tense, subject first: Loan opened, Tool returned. Its `event_field` rows carry what happened, not the whole entity: the IDs it concerns, when it happened and the values that changed, typed as entity fields are.
- `published: true` makes the event's shape a promise to other domains, which may then hear it. Domains meet only through published events: commands, queries, read models and specifications stay inside their own domain.
- **The outbox.** An event a policy hears, in its own domain or another (when it is published), is delivered by outbox, saved in the same transaction as its aggregate and delivered reliably afterwards: a lost reaction is a lost change. Its event type says so (`delivery: "outbox"`, see `write-the-technical-spec`); the check warns while it does not. An event that only keeps read models current (`fed_by`), where those read models are rebuilt from the data on every load, may be delivered in process, published or not: the next load rebuilds what a lost delivery missed.

## 3. Rules: invariants, value objects and constraints, specifications, policies

Sort each rule by what it does:

- **Constraint**: a value's own format, checked when the value is created, such as an email address looking like an address. It belongs to a value object; make the value object if the field has none, and type the fields that hold the value by it.
- **Invariant**: holds for one aggregate on every change, such as a loan being returned once. Uniqueness across records (no two members share an email) is an invariant too, enforced by a unique key of the table.
- **Specification**: a named yes-or-no predicate over one or more aggregates of one domain, such as Member has an overdue loan. Link the aggregates it `reads`; commands `checks` it before acting, and queries may select by it (`selects_by`).
- **Policy**: "whenever event X, then command Y". It sits under the command it sends and `hears` one event: its own domain's, or another domain's published one. A reaction in another aggregate is a policy, never a second change in the first command.
- A rule that needs an actor or a screen is not a domain rule: it is a UC requirement (`write-use-cases`) or a view or API requirement (`design-interactions`).

## 4. Read models and queries

- A read model is a view of the domain's data shaped for reading, such as the Catalog with each tool's status. It sits under the domain, `reads` the aggregates it reads (one or several, all of its domain) and has `read_model_field` rows, typed as entity fields are, including fields worked out from others.
- A query sits under the one read model it reads and changes nothing. Link the specifications it selects by, and the domain services it calls.

## 5. Domain services and terms

- A domain service holds logic that belongs to no single entity and is not a yes-or-no check, such as counting days in the library's time zone. Commands and queries of its domain `calls` it. It uses no storage and no outside system: its inputs are passed in.
- Each term of the domain's language is a `term` with its `meaning` in this domain. Use the terms in titles, statements and code alike.

## Example: the Tool Library's Lending domain

An aggregate with its root, a child stored in the root's table, and fields of each type:

```
add  { "aggregate": { "id": "TL-LEND-A3", "title": "Loan", "domain_id": "TL-LEND",
       "description": "One member holding one tool, from borrowing to return.", "identity": "Loan ID" } }
add  { "entity": { "id": "TL-LEND-EN04", "title": "Loan", "aggregate_id": "TL-LEND-A3", "role": "root",
       "description": "One member holding one tool, from borrowing to return." } }
add  { "entity_field": { "entity_id": "TL-LEND-EN04", "position": 1, "name": "Loan ID", "meaning": "The library's number for the loan.",
       "type": "whole number", "required": true, "column_name": "id", "example": "31" } }
add  { "entity_field": { "entity_id": "TL-LEND-EN04", "position": 2, "name": "Member", "meaning": "Who borrowed the tool.",
       "type_aggregate_id": "TL-LEND-A1", "required": true, "column_name": "member_id", "example": "12" } }
add  { "entity_field": { "entity_id": "TL-LEND-EN04", "position": 5, "name": "Due date", "meaning": "The last day of the loan, in the library's time zone.",
       "type": "date", "required": true, "example": "2026-03-16" } }
add  { "entity": { "id": "TL-LEND-EN05", "title": "Return", "aggregate_id": "TL-LEND-A3", "role": "child", "in_root_table": true,
       "description": "The end of a loan: when the tool came back and what the librarian found." } }
add  { "entity_field": { "entity_id": "TL-LEND-EN05", "position": 2, "name": "Condition", "meaning": "The tool's condition as the librarian found it.",
       "type_value_object_id": "TL-VO03", "required": true, "column_name": "return_condition", "example": "good" } }
link { "source": "TL-LEND-EN04", "relation": "has_one", "target": "TL-LEND-EN05" }
```

A command on the Loan, the event it raises, the specifications it checks and the domain service it calls:

```
add  { "command": { "id": "TL-LEND-CMD06", "title": "Return a tool", "aggregate_id": "TL-LEND-A3",
       "description": "Closes a loan, recording the time, the tool's condition and an optional note, and whether the return was late." } }
add  { "domain_event": { "id": "TL-LEND-EV06", "title": "Tool returned", "aggregate_id": "TL-LEND-A3", "published": false,
       "description": "A librarian recorded a tool's return, which closes its loan and says what condition the tool came back in." } }
add  { "event_field": { "domain_event_id": "TL-LEND-EV06", "position": 1, "name": "Loan ID", "meaning": "The loan returned.",
       "type_aggregate_id": "TL-LEND-A3", "required": true } }
add  { "event_field": { "domain_event_id": "TL-LEND-EV06", "position": 7, "name": "Late", "meaning": "Whether the loan was overdue at the moment of return.",
       "type": "yes/no", "required": true } }
link { "source": "TL-LEND-CMD06", "relation": "raises", "target": "TL-LEND-EV06" }
link { "source": "TL-LEND-CMD06", "relation": "checks", "target": "TL-LEND-SP01" }
link { "source": "TL-LEND-CMD06", "relation": "calls", "target": "TL-LEND-DS01" }
```

A tool returned needing repair must leave lending, but Return a tool changes only the Loan. The Tool follows through the event: a policy under the Tool's Report damage command hears Tool returned.

```
add  { "policy": { "id": "TL-LEND-PO01", "title": "When a tool is returned needing repair, report damage on it", "command_id": "TL-LEND-CMD03",
       "statement": "Whenever a tool is returned with the condition needs_repair, report damage on it with the return's note as the damage note." } }
link { "source": "TL-LEND-PO01", "relation": "hears", "target": "TL-LEND-EV06" }
```

Since a policy hears Tool returned, its event type is delivered by outbox (`write-the-technical-spec`). Were the two changes truly inseparable, the alternative is a recorded exception on the command:

```
add  { "command_change": { "command_id": "TL-LEND-CMD06", "aggregate_id": "TL-LEND-A2",
       "reason": "A tool returned needing repair must never be seen as available, even for a moment." } }
```

Rules sorted by what they do: a value object with its constraint, an invariant, and a specification with the aggregates it reads:

```
add  { "value_object": { "id": "TL-VO02", "title": "Email address", "description": "How the library contacts a member." } }
add  { "constraint": { "id": "TL-VO02-C02", "title": "An email address is kept trimmed and in lower case", "value_object_id": "TL-VO02",
       "statement": "An email address MUST be trimmed and kept in lower case, so two spellings of one address are the same address." } }
add  { "invariant": { "id": "TL-LEND-INV01", "title": "No two members share an email", "aggregate_id": "TL-LEND-A1",
       "statement": "Two members MUST NOT share an email address." } }
add  { "specification": { "id": "TL-LEND-SP03", "title": "Member is at the loan limit",
       "statement": "A member is at the loan limit when they hold 3 active loans. A loan stops counting when it is returned." } }
link { "source": "TL-LEND-SP03", "relation": "reads", "target": "TL-LEND-A1" }
link { "source": "TL-LEND-SP03", "relation": "reads", "target": "TL-LEND-A3" }
link { "source": "TL-LEND-CMD05", "relation": "checks", "target": "TL-LEND-SP03" }
```

A read model with a worked-out field, its query, a domain service and a term:

```
add  { "read_model": { "id": "TL-LEND-RM01", "title": "Catalog", "domain_id": "TL-LEND", "description": "Every tool with its status, as a borrower sees it." } }
add  { "read_model_field": { "read_model_id": "TL-LEND-RM01", "position": 7, "name": "Status", "type": "text", "required": true,
       "meaning": "on_loan while the tool has an active loan, else needs_repair when it needs repair, else available." } }
link { "source": "TL-LEND-RM01", "relation": "reads", "target": "TL-LEND-A2" }
link { "source": "TL-LEND-RM01", "relation": "reads", "target": "TL-LEND-A3" }
add  { "query": { "id": "TL-LEND-QRY01", "title": "List the catalog", "read_model_id": "TL-LEND-RM01",
       "description": "Every tool in the catalog, in ID order, with its status." } }
add  { "domain_service": { "id": "TL-LEND-DS01", "title": "Library calendar", "domain_id": "TL-LEND",
       "statement": "Counts days in the library's time zone: the date of a moment there, and the date a number of calendar days after another." } }
add  { "term": { "id": "TL-LEND-TM06", "title": "Active loan", "domain_id": "TL-LEND", "meaning": "A loan that has not been returned." } }
```

In a shell the same writes are `lathe add command --id TL-LEND-CMD06 --title "Return a tool" --aggregate_id TL-LEND-A3 ...` and `lathe link TL-LEND-CMD06 raises TL-LEND-EV06`.

## Rules

- Records carry no status, approval or history. A record in the data is in force; git holds the history.
- One rule per record. Use the domain's terms exactly.
- Something undecided is a `question` under the product or the domain, with an `owner` (a role, such as Owner, never a person), linked with `about` to the records it concerns. Never write "TBD" into a rule. When it is decided, `remove` the question (its `about` links go with it) and write the answer into the records it affects.
- Specs name roles, never people: write "a librarian" or "the owner", not someone's name.
- The store refuses what breaks the model outright: a second root, a command change of the command's own aggregate, a policy hearing another domain's unpublished event, a specification reading another domain's aggregate, a field with no type or two, an ID that does not start with its domain's. The checks report the rest. Each check's explanation, with how to fix what it reports, is in `REFERENCE.md` in the Lathe package.
- Finish with the `check-and-fix` skill. New obligations (constraints, invariants, specifications, policies, domain services) show as gaps until a technical record implements each and a test proves it; that is expected.
