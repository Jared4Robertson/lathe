---
name: model-a-domain
description: Split a product into domains by business capability, then write or change a Lathe domain model in event storming order - aggregates, their entities and fields, the commands that change them and the events they raise, then invariants, value objects and their constraints, specifications, policies, read models and queries, domain services, storage requirements and the domain's terms. Also the order of the whole spec, from the business outcomes to the tests. Use when deciding a product's domains, or adding or changing any domain model record, in a repo with lathe.config.json.
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
- **Mistakes are refused, not found:** a rule that can be enforced when something is written is enforced then, by the code that writes it.
- **One way to do each thing:** each intent has one command, and each rule is written once.
- **No exceptions:** a model never records a deviation from its own rules. When something does not fit, change the model or the code until it does.
- **Change the standard, not the instance:** when the standard way proves wrong, change it everywhere at once, and remove what no longer serves a purpose.

## The order of the whole spec

Write a product stage by stage, in this order, so that each record's links point at records written before it. Each stage has its skill.

1. **Discovery** (`discover-outcomes`): the product's business outcomes, each measurable, which its capabilities will serve.
2. **Domain model** (this skill), in event storming order: aggregates with their entities and fields; commands and the events they raise; then invariants, value objects and their constraints, specifications, policies, read models and queries, domain services, storage requirements and terms.
3. **Use cases** (`write-use-cases`): capabilities, each linked to the outcomes it serves, use cases with their actors, and their UC requirements; patterns they share.
4. **Interaction design** (`design-interactions`): the product's interfaces, each use case's flows (one per interface it happens through) and their steps, which invoke the commands and queries and fulfill the UC requirements; the views, endpoints and integrations the steps reach, with their view and API requirements.
5. **Technical specification** (`write-the-technical-spec`): one technical record for each design record it implements, tables and their keys, standards.
6. **Test plan** (`plan-tests`): one test kind per thing tested, each with its run by, and the test data sets tests start from.

Finish each stage with `check-and-fix`. The checks report what a later stage still owes (a command no step invokes, an obligation with no test) as gaps, not errors, because records are written stage by stage.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files. Every kind belongs to one aggregate of Lathe's own model, and each aggregate has its own tools, named for the aggregate and the command: `<aggregate>_add_<kind>`, `<aggregate>_change_<kind>` and `<aggregate>_remove_<kind>` for each kind it holds; and its reads, `<aggregate>_get_<aggregate>` (it whole, by the ID of any record in it), `<aggregate>_list_<aggregate>s` (those under a parent) and `<aggregate>_next_id`. `check` runs the checks. Each command checks its aggregate's rules and is refused, with every reason, when it breaks them; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- A record's parts (an entity's fields, an event's fields) and the links it starts (a command's `raises`, `checks` and `calls`) are fields of its own add and change: on a change a list replaces the list. There are no tools that link or unlink.
- A change never takes a parent column. A record of the domain model stays under its parent; to put it elsewhere, remove it and add it again.
- Each tool's input schema lists its fields, with each column's type and meaning. In a shell the same commands are `lathe <aggregate> <command> --<field> <value>` (`lathe command add-command --help` prints its fields; `npx lathe` in a product repo, `npm --prefix lathe run lathe -- <aggregate> <command> --root ..` in the Lathe repo). For an Owner's script, and text with quotes, newlines or backticks, a command also takes the tool's own JSON, on stdin with `--json -` or from a file with `--json <file>`.
- Take each new record's ID from its aggregate's `<aggregate>_next_id`, with the kind and the record it will sit under as `parent`; for a value object give the product, for a specification its domain. Domain model IDs are numbered across the domain (`TL-LEND-CMD05`), whatever aggregate they sit under. IDs are never reused or renumbered.

The tools of this stage, by aggregate:

| Aggregate | Its tools |
| --- | --- |
| Domain | `domain_add_domain`, `domain_add_term`, `domain_add_domain_service`; each with its change and remove tools; `domain_get_domain`, `domain_list_domains`, `domain_next_id` |
| Aggregate | `aggregate_add_aggregate`, `aggregate_add_entity` (with its fields, and its `has_one` and `has_many` children), `aggregate_add_invariant`; each with its change and remove tools; `aggregate_get_aggregate`, `aggregate_list_aggregates`, `aggregate_next_id` |
| Domain event | `domain_event_add_domain_event` (with its fields); its change and remove tools; `domain_event_get_domain_event`, `domain_event_list_domain_events`, `domain_event_next_id` |
| Command | `command_add_command` (under the entity it changes, with what it `raises`, `checks` and `calls`), `command_add_policy` (with the event it `hears`); each with its change and remove tools; `command_get_command`, `command_list_commands`, `command_next_id` |
| Value object | `value_object_add_value_object` (with its fields), `value_object_add_constraint`; each with its change and remove tools; `value_object_get_value_object`, `value_object_list_value_objects`, `value_object_next_id` |
| Specification | `specification_add_specification` (with the aggregates it `reads`); its change and remove tools; `specification_get_specification`, `specification_list_specifications`, `specification_next_id` |
| Read model | `read_model_add_read_model` (with its fields and what it `reads`), `read_model_add_query` (with what it `selects_by` and `calls`); each with its change and remove tools; `read_model_get_read_model`, `read_model_list_read_models`, `read_model_next_id` |
| Product | `product_add_question` (with what it is `about`), `product_change_question`, `product_move_question`, `product_remove_question` |

## Before you write

1. `product_get_product` and `domain_get_domain`, and list what is there with each aggregate's list tool (`aggregate_list_aggregates`, `command_list_commands` and the rest, with the domain or the aggregate as `parent`), so a new record does not repeat an old one.
2. Read the domain's terms in `domain_get_domain` and use them exactly.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `domain` | the product | `<P>-<D>` | `subdomain_type`; `description`: what it covers, in a paragraph. |
| `aggregate` | the domain | `<P>-<D>-A<n>` | The consistency boundary, named for its root. `identity`: what tells two apart in the business; `description`: what it keeps and why its entities change together, in a paragraph. |
| `entity` | an aggregate | `<P>-<D>-EN<nn>` | A record with an identity. `role`: `root` (exactly one per aggregate) or `child`; `in_root_table: true` for a child stored in its root's table; `description`: what it is, in a sentence or two. `fields`: its fields, in order. |
| `command` | the entity it changes | `<P>-<D>-CMD<nn>` | A request to change that entity, and so its one aggregate, named as an imperative (Borrow a tool); `description`: what it changes and when it is refused, in a sentence or two, never how its handler does it. Links: `raises` events, `checks` specifications, `calls` domain services. |
| `domain_event` | an aggregate | `<P>-<D>-EV<nn>` | Something that happened, in the past tense (Loan opened); `description`: what happened and what brings it about, in a sentence. `published`: whether other domains may hear it. `fields`: its fields, in order. |
| `invariant` | an aggregate | `<P>-<D>-INV<nn>` | `statement`: what holds for that aggregate on every change. |
| `value_object` | none | `<P>-VO<nn>` | A value with no identity, such as an email address; `description`: what the value is, in a sentence or two. `fields` when it has more than one part. |
| `constraint` | a value object | `<value object>-C<nn>` | `statement`: the value object's own rule, checked when a value is created. |
| `specification` | none | `<P>-<D>-SP<nn>` | `statement`: a named yes-or-no predicate. Links: `reads` the aggregates it reads, all of its domain. |
| `policy` | the command it invokes | `<P>-<D>-PO<nn>` | `statement`: whenever an event, then this command. Link: `hears` its one event. |
| `read_model` | the domain | `<P>-<D>-RM<nn>` | A view of the domain's data shaped for reading; `description`: what it shows and from what, in a sentence or two. `fields`: its fields, in order. Link: `reads` the aggregates it reads. |
| `query` | a read model | `<P>-<D>-QRY<nn>` | A question asked of that read model; it changes nothing. `description`: what it returns, in what order, in a sentence or two. Links: `selects_by` specifications, `calls` domain services. |
| `storage_requirement` | an aggregate or a read model | `<aggregate or read model>-SR<nn>` | `statement`: what the business needs kept of it and how well: whichever apply of durability (it survives a restart or a crash), atomicity (saved whole or not at all, such as a loan with its outbox event), retention and deletion (how long; deleted on request), recovery (backups, acceptable loss) and capacity (how much, how fast). Written with `storage_requirement_add_storage_requirement`, and proved by its storage requirement tests (`plan-tests`). |
| `domain_service` | the domain | `<P>-<D>-DS<nn>` | `statement`: domain logic that belongs to no single entity and is not a yes-or-no check, such as a due date or a late fee. |
| `term` | the domain | `<P>-<D>-TM<nn>` | The word as `title`, `meaning`: what it means in this domain, and `builds_on`: the terms its meaning uses. |

Every `statement` is one rule in one sentence or two, with MUST / MUST NOT where it is a rule.

Every kind's text is required or absent (`LA-STD-MODELING-R10`): each kind above has one lead (`statement`, `meaning` or `description`), and its add refuses a record without it. Write what a reader cannot get from the title, the parent and the links, and never restate another record.

## Naming

Every record's `title` follows one convention, whatever its kind: sentence case, no trailing period, and unique within its kind and product. A duplicate title or a trailing period is refused. Names take 1 to 4 words, goals 2 to 6, statements one short sentence (about 15 words); detail goes in the `statement` or `description`, never the title.

| Kind | Title | Good | Not |
| --- | --- | --- | --- |
| domain | a noun for a business area | Lending | Loan management screens |
| aggregate, entity, value object, term, read model | a singular noun phrase, no article | Loan, Email address, Loan history | The loans |
| domain service | a noun phrase for what it works out | Due date | Calculate due date |
| command | the domain's own imperative verb and its object | Borrow a tool | Tool borrowing, Create a loan record |
| query | Get, List or Find and its object | List overdue loans | Overdue loans |
| domain event | a past participle phrase, subject first | Tool borrowed | Borrow tool |
| policy | "When" the event, then the reaction | When a tool is returned damaged, hold it for repair | Damage policy |
| invariant, constraint | a sentence that is true when the rule holds | A loan has one borrower | Loan borrower rule |
| specification | a yes-or-no condition, no article | Tool is available | The tool is available |

A command names the domain's own verb: Borrow, Approve, Refund, never Create, Update or Delete over "a record" or "data". `lathe check` warns of a query that does not start with Get, List or Find, a specification that starts with A, An or The, and a domain event not in the past tense (`event-tense`). Capabilities and use cases are named in `write-use-cases`.

## 1. Aggregates and entities

- An aggregate is what one command changes as a unit, in one transaction, keeping all its invariants. Start from the records that must change together and stay consistent; anything with a life of its own is the root of another aggregate.
- Each aggregate has one `root` entity, named as the aggregate is. Add a `child` only for a part that lives and dies with the root, such as a return of a loan, and name it in the root's, or the parent child's, `has_one` or `has_many`.
- A child stored in its root's table, as its columns, has `in_root_table: true` and no table of its own.
- An entity's `fields` are its fields in order, each name once. A field's type is exactly one of: `type`, a basic type (`text`, `whole number`, `decimal`, `date`, `time`, `date and time`, `yes/no`); `type_value_object_id`, a value object; or `type_aggregate_id`, a reference to another aggregate by its ID. `required` says whether every record gives it a value. `column_name` names its column when that differs from the field's name, such as `id` for a Loan ID. `example` gives one real-looking value.
- Aggregates refer to each other by ID only: a Loan's Member is a field typed by the Member aggregate, never a `has_one`. A reference to an aggregate of the same domain becomes a foreign key; one to another domain's stays a plain ID.
- **One repository per aggregate.** Each aggregate is loaded and saved whole by its own repository, a technical record (`write-the-technical-spec`) that `persists` it, and each repository persists exactly one aggregate. Code that loads and saves several aggregates the same way, such as a generic store, is split into one repository per aggregate. An aggregate no repository persists is a coverage gap (`aggregate-without-repository`); a second repository for an aggregate, or a second aggregate for a repository, is refused; a repository that persists none is an error.
- Leave out fields that are worked out, such as a count of active loans or an overdue flag: they are specifications or read model fields, since a table's columns follow from its entity's fields.

## 2. Commands and events

- **One aggregate per command.** A command sits under the entity it changes, and so changes exactly one aggregate: the one that holds that entity. When something must follow in another aggregate, raise an event and let a policy send that aggregate's command: the change follows through the event.
- **Small aggregates.** An aggregate is the smallest cluster that must stay consistent after one command: most need a root and a few children. The check warns of an aggregate with more entities than the product's `max_entities_per_aggregate` setting (7 by default): split it into smaller aggregates that each change together, and keep a rule that spans two as a specification the command checks, or follow it through an event and a policy. Do not raise the setting to silence the warning unless the user asks.
- **When two aggregates seem to need one change,** the model is wrong, not the rule: split the aggregate so each command changes one, or follow the second change through an event and a policy. Two records that must never be seen apart belong to one aggregate.
- A command `raises` each event it may raise, of its own aggregate. An event no command raises is a gap.
- Name an event in the past tense, subject first: Loan opened, Tool returned. Its `fields` carry what happened, not the whole entity: the IDs it concerns, when it happened and the values that changed, typed as entity fields are.
- `published: true` makes the event's shape a promise to other domains, which may then hear it. Domains meet only through published events: commands, queries, read models and specifications stay inside their own domain.
- **The outbox.** An event a policy hears, in its own domain or another (when it is published), is delivered by outbox, saved in the same transaction as its aggregate and delivered reliably afterwards: a lost reaction is a lost change. Its event type says so (`delivery: "outbox"`, see `write-the-technical-spec`); the check warns while it does not. An event that only keeps read models current (`fed_by`), where those read models are rebuilt from the data on every load, may be delivered in process, published or not: the next load rebuilds what a lost delivery missed.

## 3. Rules: invariants, value objects and constraints, specifications, policies

Sort each rule by what it does:

- **Constraint**: a value's own format, checked when the value is created, such as an email address looking like an address. It belongs to a value object; make the value object if the field has none, and type the fields that hold the value by it.
- **Invariant**: holds for one aggregate on every change, such as a loan being returned once. Uniqueness across records (no two members share an email) is an invariant too, enforced by a unique key of the table.
- **Specification**: a named yes-or-no predicate over one or more aggregates of one domain, such as Member has an overdue loan. Name the aggregates it `reads`; commands `checks` it before acting, and queries may select by it (`selects_by`).
- **Policy**: "whenever event X, then command Y". It sits under the command it sends and `hears` one event: its own domain's, or another domain's published one. A reaction in another aggregate is a policy, never a second change in the first command.
- A rule that needs an actor or a screen is not a domain rule: it is a UC requirement (`write-use-cases`) or a view or API requirement (`design-interactions`).

## 4. Read models and queries

- A read model is a view of the domain's data shaped for reading, such as the Catalog with each tool's status. It sits under the domain, `reads` the aggregates it reads (one or several, all of its domain) and has `fields`, typed as entity fields are, including fields worked out from others.
- A query sits under the one read model it reads and changes nothing. Name the specifications it selects by, and the domain services it calls.

## 5. Domain services and terms

- A domain service holds logic that belongs to no single entity and is not a yes-or-no check, such as counting days in the library's time zone. Commands and queries of its domain `calls` it. It uses no storage and no outside system: its inputs are passed in.
- Each term of the domain's language is a `term` with its `meaning` in this domain. Use the terms in titles, statements and code alike.
- Definitions build up, never in a circle (LA-STD-MODELING-R12): define a term only with plain words and terms below it, and link each term its meaning uses with `builds_on`. Start from the smallest ideas; when two terms would name each other, say the lower one in plain words. The store refuses a loop (`term-builds-on-itself`), and `term-used-unlinked` warns of a meaning that uses a term's title without the link.

## Example: the Tool Library's Lending domain

An aggregate with its root, a child stored in the root's table, and fields of each type:

```
aggregate_add_aggregate { "id": "TL-LEND-A3", "title": "Loan", "domain_id": "TL-LEND",
       "description": "One member holding one tool, from borrowing to return.", "identity": "Loan ID" }
aggregate_add_entity { "id": "TL-LEND-EN05", "title": "Return", "aggregate_id": "TL-LEND-A3", "role": "child", "in_root_table": true,
       "description": "The end of a loan: when the tool came back and what the librarian found.",
       "fields": [ { "name": "Condition", "meaning": "The tool's condition as the librarian found it.",
                     "type_value_object_id": "TL-VO03", "required": true, "column_name": "return_condition", "example": "good" } ] }
aggregate_add_entity { "id": "TL-LEND-EN04", "title": "Loan", "aggregate_id": "TL-LEND-A3", "role": "root",
       "description": "One member holding one tool, from borrowing to return.",
       "fields": [ { "name": "Loan ID", "meaning": "The library's number for the loan.", "type": "whole number", "required": true, "column_name": "id", "example": "31" },
                   { "name": "Member", "meaning": "Who borrowed the tool.", "type_aggregate_id": "TL-LEND-A1", "required": true, "column_name": "member_id", "example": "12" },
                   { "name": "Due date", "meaning": "The last day of the loan, in the library's time zone.", "type": "date", "required": true, "example": "2026-03-16" } ],
       "has_one": ["TL-LEND-EN05"] }
```

A command on the Loan's Return (a command sits under the entity it changes), the event it raises, the specifications it checks and the domain service it calls. The event is added first, so the command can name it:

```
domain_event_add_domain_event { "id": "TL-LEND-EV06", "title": "Tool returned", "aggregate_id": "TL-LEND-A3", "published": false,
       "description": "A librarian recorded a tool's return, which closes its loan and says what condition the tool came back in.",
       "fields": [ { "name": "Loan ID", "meaning": "The loan returned.", "type_aggregate_id": "TL-LEND-A3", "required": true },
                   { "name": "Late", "meaning": "Whether the loan was overdue at the moment of return.", "type": "yes/no", "required": true } ] }
command_add_command { "id": "TL-LEND-CMD06", "title": "Return a tool", "entity_id": "TL-LEND-EN05",
       "description": "Closes a loan, recording the time, the tool's condition and an optional note, and whether the return was late.",
       "raises": ["TL-LEND-EV06"], "checks": ["TL-LEND-SP01"], "calls": ["TL-LEND-DS01"] }
```

A tool returned needing repair must leave lending, but Return a tool changes only the Loan. The Tool follows through the event: a policy under the Tool's Report damage command hears Tool returned.

```
command_add_policy { "id": "TL-LEND-PO01", "title": "When a tool is returned needing repair, report damage on it", "command_id": "TL-LEND-CMD03",
       "statement": "Whenever a tool is returned with the condition needs_repair, report damage on it with the return's note as the damage note.",
       "hears": "TL-LEND-EV06" }
```

Since a policy hears Tool returned, its event type is delivered by outbox (`write-the-technical-spec`). Were the two changes truly inseparable, Loan and Tool would be one aggregate, changed by one command.

Rules sorted by what they do: a value object with its constraint, an invariant, and a specification with the aggregates it reads:

```
value_object_add_value_object { "id": "TL-VO02", "title": "Email address", "description": "How the library contacts a member." }
value_object_add_constraint { "id": "TL-VO02-C02", "title": "An email address is kept trimmed and in lower case", "value_object_id": "TL-VO02",
       "statement": "An email address MUST be trimmed and kept in lower case, so two spellings of one address are the same address." }
aggregate_add_invariant { "id": "TL-LEND-INV01", "title": "No two members share an email", "aggregate_id": "TL-LEND-A1",
       "statement": "Two members MUST NOT share an email address." }
specification_add_specification { "id": "TL-LEND-SP03", "title": "Member is at the loan limit",
       "statement": "A member is at the loan limit when they hold 3 active loans. A loan stops counting when it is returned.",
       "reads": ["TL-LEND-A1", "TL-LEND-A3"] }
command_change_command { "id": "TL-LEND-CMD05", "checks": ["TL-LEND-SP02", "TL-LEND-SP03"] }
```

A change's list replaces the list, so `command_change_command` names every specification the command checks, the new one with the old.

A read model with a worked-out field, its query, a domain service and a term:

```
read_model_add_read_model { "id": "TL-LEND-RM01", "title": "Catalog", "domain_id": "TL-LEND", "description": "Every tool with its status, as a borrower sees it.",
       "fields": [ { "name": "Status", "type": "text", "required": true,
                     "meaning": "on_loan while the tool has an active loan, else needs_repair when it needs repair, else available." } ],
       "reads": ["TL-LEND-A2", "TL-LEND-A3"] }
read_model_add_query { "id": "TL-LEND-QRY01", "title": "List the catalog", "read_model_id": "TL-LEND-RM01",
       "description": "Every tool in the catalog, in ID order, with its status." }
domain_add_domain_service { "id": "TL-LEND-DS01", "title": "Library calendar", "domain_id": "TL-LEND",
       "statement": "Counts days in the library's time zone: the date of a moment there, and the date a number of calendar days after another." }
domain_add_term { "id": "TL-LEND-TM06", "title": "Active loan", "domain_id": "TL-LEND", "meaning": "A loan that has not been returned.", "builds_on": ["TL-LEND-TM05"] }
```

In a shell the same commands are `lathe command add-command --id TL-LEND-CMD06 --title "Return a tool" --entity_id TL-LEND-EN05 --raises TL-LEND-EV06 ...` (a list's flag once per item), or `lathe command add-command --json -` with the object above piped in.

## Rules

- Records carry no status, approval or history. A record in the data is in force; git holds the history.
- One rule per record. Use the domain's terms exactly.
- Something undecided is a question (`product_add_question`) under the product or the domain, with an `owner` (a role, such as Owner, never a person), and the records it is `about`. Never write "TBD" into a rule. When it is decided, remove the question (`product_remove_question`) and write the answer into the records it affects.
- Specs name roles, never people: write "a librarian" or "the owner", not someone's name.
- Each command refuses what breaks its aggregate's rules outright: a second root, a policy hearing another domain's unpublished event, a specification reading another domain's aggregate, a field with no type or two, an ID that does not start with its domain's. The checks report the rest. Each check's explanation, with how to fix what it reports, is in `REFERENCE.md` in the Lathe package.
- Finish with the `check-and-fix` skill. New obligations (constraints, invariants, specifications, policies, domain services, storage requirements) show as gaps until a technical record implements each and a test proves it; that is expected.
