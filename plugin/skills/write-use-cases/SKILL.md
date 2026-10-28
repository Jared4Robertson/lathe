---
name: write-use-cases
description: Write or change Lathe use cases - the capabilities that group a domain's use cases, each use case's actors and goal, its UC requirements, the product's roles, and the patterns use cases share with their settings and rules. Use when adding what an actor does with the product, splitting a use case, grouping use cases into capabilities, naming or renaming a capability or use case, or writing behavior several use cases share as a pattern, in a repo with lathe.config.json.
---

# Write use cases

A use case is an actor's goal: who acts, what they want, and the rules the product must follow while they reach it. It changes nothing itself. It happens through one or more of the product's interfaces (its web app, its API, its CLI), with one flow for each, whose steps invoke the domain's commands and queries (see `design-interactions`), so write use cases after the domain model (`model-a-domain`), whose commands, queries and terms they use.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means. In a shell, `lathe add <table> --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each new record's ID from `next_id`, with the record it will sit under as `parent`. IDs are never reused or renumbered.

## Before you write

1. `show` the domain and `list` its terms, commands and queries. Use the terms exactly; know which command or query each step of the use case will invoke.
2. `list` the domain's capabilities and each one's use cases (`parent`: the capability), so a new use case does not repeat an old one.
3. `list` the product's patterns and `show` the domain to see the patterns it follows.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `capability` | the domain | `<P>-<D>-CAP<nn>` | `position`: its place in the domain, unique there. `description`: what it covers. Link: `serves` the business outcomes it serves (the `discover-outcomes` skill). |
| `use_case` | a capability | `<P>-<D>-UC<nn>` | `goal`: what the actor wants, in one sentence. `notes`: anything longer, such as the order of checks. Its actors are `use_case_actor` rows. Link: `follows` the patterns it shares. |
| `use_case_actor` (part) | the use case | its `position` | `role_name`: one of the product's roles. |
| `uc_requirement` | the use case | `<use case>-R<nn>` | Title: the rule in a few words. `statement`: the rule with MUST / MUST NOT / SHOULD / MAY. `group_name`: a heading once there are more than about 8. |
| `role` (part) | the product | its `name` | `description`: what the role does. |
| `pattern` | the product | `<P>-PAT-<NAME>`, a name you choose | `description`: the shared behavior. Its settings are `pattern_setting` rows and its rules `pattern_rule` records. |
| `pattern_setting` (part) | the pattern | its `position` | `name`: lower case with underscores; `meaning`: what each follower decides. |
| `pattern_rule` | the pattern | `<pattern>-R<nn>` | `statement`; `setting`, a setting it depends on; the applies-when columns (see Patterns). |
| `setting_value` (part) | the follower | `pattern_id` and `setting` | `value`, or `not_applicable` with the reason. |

## Naming

Every record's `title` is in sentence case, with no trailing period, and unique within its kind and product; the store refuses a duplicate or a trailing period (`LA-STD-MODELING-R04`). Names take 1 to 4 words, goals 2 to 6, statements one short sentence; detail goes in the `goal`, `statement` or `description`. Capabilities and use cases have their own section below.

| Kind | Title | Good | Not |
| --- | --- | --- | --- |
| pattern | a singular noun phrase, no article | Librarian action | The librarian actions |
| UC requirement, pattern rule | a sentence that is true when the rule holds | An unavailable tool is refused with the reason | Unavailable tool handling |

## Capabilities

Every use case sits in a capability: an ordered slice of its domain, such as 01 Catalog, 02 Lending. Add the domain's capabilities first, then each use case under the one it belongs to. Move a use case to another capability with `move`; its ID never changes. A capability with no use case, or one with a single use case, is a gap the check reports, and so is a capability that serves no business outcome.

## Naming capabilities and use cases

Names follow two conventions (`LA-STD-MODELING-R02` and `R03`), and the `title-breaks-convention` check warns of the parts it can read.

**A capability is a noun phrase naming a lasting ability of the business**, two to four words: a subject and an activity noun, or a single noun when the area is clear on its own. It says what, not how: it does not start with an -ing word or "The", and names no screen, tool or technology. It would still be true if the product were rebuilt on other technology.

| Good | Not | Why not |
| --- | --- | --- |
| Invoice management | Managing invoices | Starts with an -ing word |
| Payment processing | The payment screen | Starts with "The"; names a screen |
| Member registration | Members, sign-up and profiles | A list, not one ability |
| Lending | Lending through the web app | Names an interface |

**A use case is an actor's goal, verb first**, two to six words: an imperative verb and its object, with a qualifier only when needed. Use the domain's own verb (Borrow, Approve, Refund) over Create, Read, Update or Delete, unless that really is the goal. One goal: no "and" joining two goals, and no list. It names no interface or mechanism (the command line, the desktop app, a page, the API, the command layer): the use case happens through interfaces, and each flow names its own.

| Good | Not | Why not |
| --- | --- | --- |
| Borrow a tool | Create a loan record | A CRUD verb where the domain has its own |
| Approve an invoice | Approve an invoice from the web app | Names an interface |
| Register a member | Register a member and send a welcome | Two goals |
| Read an invoice | Read invoices, credit notes and receipts | A list |
| Report damage | Damage report page | Not verb first; names a page |

## Roles

A use case's actors name roles, never people: Member or Librarian in the Tool Library; Owner, Reader or Agent in Lathe's own specs. `list` the `role` table with the product as `parent`; an actor must be one of them. If a new role is needed, `add` it with a description of what the role does. Write the same roles in prose: "the librarian", "the owner".

## UC requirements

A UC requirement is one rule the use case must follow, stated at the level of the actor's goal: what the actor must be able to do, or must be refused, and what they are told.

- One rule per record, each testable on its own. A use case test proves it (see `plan-tests`).
- It does not restate the domain model. An invariant, a specification or a constraint the use case's command keeps is already owed there; write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- It says what, not how. A rule that names a route, a status code, a field limit or a screen element belongs to a view or an endpoint, as a view or API requirement (see `design-interactions`).
- It holds whatever the interface: a step of each of the use case's flows fulfills it, and only steps of its own flows do. A requirement a flow misses is a gap. A rule only one interface can meet, such as a button or a status code, is a view or API requirement instead.
- Sort more than about 8 into groups with `group_name`, such as Validation or Errors; give each group at least two.

## Patterns

When two or more use cases would state the same rules, write those rules once as a pattern and let each use case follow it. A setting is what each use case decides differently, such as the record it saves. A pattern every use case applies the same way has no settings.

- Link a follower with `follows` before its `setting_value` rows: a setting value needs the link. A use case that follows a pattern with settings gives every setting, as a `value` or as `not_applicable` with the reason.
- When a pattern applies to a whole domain, link the **domain** with `follows`; its use cases need not follow it one by one.
- The use case's requirements do not restate the pattern's rules.
- Every domain that follows the pattern, itself or through its use cases, owes each rule a pattern rule test in that domain (see `plan-tests`). A rule whose `setting` all of a domain's followers mark not applicable is not owed there.
- A rule that holds only for some values of a setting says so with `applies_when_setting`, `applies_when_value` and `applies_when_negated` (false for "is", true for "is not"); give all three or none.
- A rule about how code is written, which you follow and cite rather than prove, is a standard rule (see `write-the-technical-spec`).

## Example: the Tool Library

A capability with the outcome it serves, a use case in it with its actor, and a UC requirement:

```
add  { "capability": { "id": "TL-LEND-CAP03", "title": "Lending", "domain_id": "TL-LEND", "position": 3,
       "description": "A member borrows a tool, and a librarian takes it back." } }
add  { "use_case": { "id": "TL-LEND-UC03", "title": "Borrow a tool", "capability_id": "TL-LEND-CAP03",
       "goal": "A member borrows an available tool for the loan period.",
       "notes": "The checks run in this order, and the first that fails is the reason given: unknown member, unknown tool, an overdue loan, the loan limit, the tool needing repair, the tool on loan." } }
link { "source": "TL-LEND-CAP03", "relation": "serves", "target": "TL-BO01" }
add  { "use_case_actor": { "use_case_id": "TL-LEND-UC03", "position": 1, "role_name": "Member" } }
add  { "uc_requirement": { "id": "TL-LEND-UC03-R04", "title": "An unavailable tool is refused with the reason", "use_case_id": "TL-LEND-UC03",
       "statement": "Borrowing MUST be refused when the tool is on loan or needs repair, and the member MUST be told which." } }
```

A pattern with a setting and a rule, and a use case that follows it:

```
add  { "pattern": { "id": "TL-PAT-LIBRARIAN-ACTION", "title": "Librarian action", "product_id": "TL",
       "description": "A librarian at the desk enters a few details, and the library saves one record and shows what it saved." } }
add  { "pattern_setting": { "pattern_id": "TL-PAT-LIBRARIAN-ACTION", "position": 1, "name": "required_input",
       "meaning": "What the librarian must enter for the action to go ahead." } }
add  { "pattern_rule": { "id": "TL-PAT-LIBRARIAN-ACTION-R01", "title": "Missing input is refused", "pattern_id": "TL-PAT-LIBRARIAN-ACTION",
       "setting": "required_input",
       "statement": "When the librarian leaves out any of the required input, the library MUST refuse the action, say what is missing, and save nothing." } }
link { "source": "TL-LEND-UC01", "relation": "follows", "target": "TL-PAT-LIBRARIAN-ACTION" }
add  { "setting_value": { "follower_id": "TL-LEND-UC01", "pattern_id": "TL-PAT-LIBRARIAN-ACTION", "setting": "required_input",
       "value": "The member's name and a valid email address." } }
```

To stop following a pattern, `remove` the setting values first, then `unlink`.

## Rules

- Every use case has at least one actor and one UC requirement, unless all its rules come from its patterns; the check reports what is missing.
- A use case changes nothing itself: it names no aggregate and no event. What it changes follows from the commands its flows' steps invoke.
- Something undecided is a `question` with an `owner` (a role, such as Owner), linked with `about` to the use case, never "TBD" in a requirement.
- Next, write each use case's flows, one per interface it happens through, with the `design-interactions` skill, then finish with `check-and-fix`.
