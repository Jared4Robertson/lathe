---
name: write-use-cases
description: Write or change Lathe use cases - the capabilities that group a domain's use cases, each use case's actors and goal, its UC requirements, the product's roles, and the patterns use cases share with their settings and rules. Use when adding what an actor does with the product, splitting a use case, grouping use cases into capabilities, naming or renaming a capability or use case, or writing behavior several use cases share as a pattern, in a repo with lathe.config.json.
---

# Write use cases

A use case is an actor's goal: who acts, what they want, and the rules the product must follow while they reach it. It changes nothing itself. It happens through one or more of the product's interfaces (its web app, its API, its CLI), with one flow for each, whose steps invoke the domain's commands and queries (see `design-interactions`), so write use cases after the domain model (`model-a-domain`), whose commands, queries and terms they use.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files. Every kind belongs to one aggregate of Lathe's own model, and each aggregate has its own tools, named for the aggregate and the command: `<aggregate>_add_<kind>`, `<aggregate>_change_<kind>` and `<aggregate>_remove_<kind>` for each kind it holds, a move where a record really moves (a use case to another capability); and its reads, `<aggregate>_get_<aggregate>` (it whole, by the ID of any record in it), `<aggregate>_list_<aggregate>s` (those under a parent) and `<aggregate>_next_id`. `check` runs the checks. Each command checks its aggregate's rules and is refused, with every reason, when it breaks them; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- A record's parts (a use case's `actors`, a pattern's `settings`) and the links it starts (a capability's `serves`) are fields of its own add and change: on a change a list replaces the list. There are no tools that link or unlink.
- Each tool's input schema lists its fields, with each column's type and meaning. In a shell the same commands are `lathe <aggregate> <command> --<field> <value>` (`lathe use-case add-use-case --help` prints its fields; `npx lathe` in a product repo, `npm --prefix lathe run lathe -- <aggregate> <command> --root ..` in the Lathe repo). An Owner's script hands a command the tool's own JSON instead of flags, on stdin with `--json -` or from a file with `--json <file>`, so a long statement keeps its quotes and newlines.
- Take each new record's ID from its aggregate's `<aggregate>_next_id`, with the kind and the record it will sit under as `parent`. IDs are never reused or renumbered.

The tools of this stage, by aggregate:

| Aggregate | Its tools |
| --- | --- |
| Domain | `domain_add_capability` (with the outcomes it `serves`), `domain_change_capability`, `domain_remove_capability`; `domain_get_domain`, `domain_next_id` |
| Use case | `use_case_add_use_case` (with its `actors`), `use_case_change_use_case`, `use_case_move_use_case`, `use_case_remove_use_case`; `use_case_add_uc_requirement`, `use_case_change_uc_requirement`, `use_case_remove_uc_requirement`; `use_case_get_use_case`, `use_case_list_use_cases`, `use_case_next_id` |
| Product | `product_change_product` (with its `roles`); `product_get_product` |
| Pattern | `pattern_add_pattern` (with its `settings`), `pattern_add_pattern_rule`; each with its change and remove tools; `pattern_get_pattern`, `pattern_list_patterns`, `pattern_next_id` |
| Pattern following | `pattern_following_follow_pattern` (with its `setting_values`), `pattern_following_change_setting_values`, `pattern_following_stop_following_pattern` |

## Before you write

1. `domain_get_domain` for its terms, and `command_list_commands` and `read_model_list_read_models` for its commands and queries. Use the terms exactly; know which command or query each step of the use case will invoke.
2. `domain_get_domain` lists the domain's capabilities; `use_case_list_use_cases` lists each one's use cases (`capability_id`), so a new use case does not repeat an old one.
3. `pattern_list_patterns` for the product's patterns, and `domain_get_domain` for the patterns the domain follows.

## The records

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `capability` | the domain | `<P>-<D>-CAP<nn>` | `position`: its place in the domain, unique there. `description` (required): what it covers, in a sentence or two. Link: `serves` the business outcomes it serves (the `discover-outcomes` skill). |
| `use_case` | a capability | `<P>-<D>-UC<nn>` | `goal` (required): what the actor wants to reach and from where they start, in a sentence or a short paragraph. `notes`: anything longer, such as the order of checks. `actors`: the product's roles that act in it, the main actor first. It follows the patterns it shares (Pattern following). |
| `uc_requirement` | the use case | `<use case>-R<nn>` | Title: the rule in a few words. `statement`: the rule with MUST / MUST NOT / SHOULD / MAY. `group_name`: a heading once there are more than about 8. |
| role (a part of the product) | the product | its `name` | `description` (required): who takes the role and what they do, in a sentence. |
| `pattern` | the product | `<P>-PAT-<NAME>`, a name you choose | `description` (required): the shared behavior, in a paragraph. `settings`: what each follower decides, each a `name` (lower case with underscores) and its `meaning`. Its rules are `pattern_rule` records. |
| `pattern_rule` | the pattern | `<pattern>-R<nn>` | `statement`; `setting`, a setting it depends on. |
| setting values (a part of following a pattern) | the follower | `setting` | The `value` the follower gives the setting. |

## Naming

Every record's `title` is in sentence case, with no trailing period, and unique within its kind and product; the store refuses a duplicate or a trailing period (`LA-STD-MODELING-R04`). Names take 1 to 4 words, goals 2 to 6, statements one short sentence; detail goes in the `goal`, `statement` or `description`. Capabilities and use cases have their own section below.

| Kind | Title | Good | Not |
| --- | --- | --- | --- |
| pattern | a singular noun phrase, no article | Librarian action | The librarian actions |
| UC requirement, pattern rule | a sentence that is true when the rule holds | An unavailable tool is refused with the reason | Unavailable tool handling |

## Capabilities

Every use case sits in a capability: an ordered slice of its domain, such as 01 Catalog, 02 Lending. Add the domain's capabilities first, then each use case under the one it belongs to. Move a use case to another capability with `use_case_move_use_case`; its ID never changes. A capability with no use case, or one with a single use case, is a gap the check reports, and so is a capability that serves no business outcome.

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

A use case's actors name roles, never people: Member or Librarian in the Tool Library; Owner, Reader or Agent in Lathe's own specs. `product_get_product` lists the product's roles; an actor must be one of them. If a new role is needed, add it to the product's `roles` with `product_change_product` (the list replaces the list, so give every role), with a description of what the role does. Write the same roles in prose: "the librarian", "the owner".

## UC requirements

A UC requirement is one rule the use case must follow, stated at the level of the actor's goal: what the actor must be able to do, or must be refused, and what they are told.

- One rule per record, each testable on its own. A use case test proves it (see `plan-tests`).
- It does not restate the domain model. An invariant, a specification or a constraint the use case's command keeps is already owed there; write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- It says what, not how. A rule that names a route, a status code, a field limit or a screen element belongs to a view or an endpoint, as a view or API requirement (see `design-interactions`).
- It holds whatever the interface: a step of each of the use case's flows fulfills it, and only steps of its own flows do. A requirement a flow misses is a gap. A rule only one interface can meet, such as a button or a status code, is a view or API requirement instead.
- Sort more than about 8 into groups with `group_name`, such as Validation or Errors; give each group at least two.

## Patterns

When two or more use cases would state the same rules, write those rules once as a pattern and let each use case follow it. A setting is what each use case decides differently, such as the record it saves. A pattern every use case applies the same way has no settings.

- A follower follows a pattern with `pattern_following_follow_pattern`, giving every setting its value in the same command.
- When a pattern applies to a whole domain, the **domain** follows it; its use cases need not follow it one by one.
- The use case's requirements do not restate the pattern's rules.
- Every domain that follows the pattern, itself or through its use cases, owes each rule a pattern rule test in that domain (see `plan-tests`).
- A pattern's rules hold for every follower. A rule that holds only for some of them is not the pattern's: write it as a UC requirement of those use cases, or as another pattern they follow.
- A rule about how code is written, which you follow and cite rather than prove, is a standard rule (see `write-the-technical-spec`).

## Example: the Tool Library

A capability with the outcome it serves, a use case in it with its actor, and a UC requirement:

```
domain_add_capability { "id": "TL-LEND-CAP03", "title": "Lending", "domain_id": "TL-LEND", "position": 3,
       "description": "A member borrows a tool, and a librarian takes it back.", "serves": ["TL-BO01"] }
use_case_add_use_case { "id": "TL-LEND-UC03", "title": "Borrow a tool", "capability_id": "TL-LEND-CAP03",
       "goal": "A member borrows an available tool for the loan period.",
       "notes": "The checks run in this order, and the first that fails is the reason given: unknown member, unknown tool, an overdue loan, the loan limit, the tool needing repair, the tool on loan.",
       "actors": ["Member"] }
use_case_add_uc_requirement { "id": "TL-LEND-UC03-R04", "title": "An unavailable tool is refused with the reason", "use_case_id": "TL-LEND-UC03",
       "statement": "Borrowing MUST be refused when the tool is on loan or needs repair, and the member MUST be told which." }
```

A pattern with a setting and a rule, and a use case that follows it:

```
pattern_add_pattern { "id": "TL-PAT-LIBRARIAN-ACTION", "title": "Librarian action", "product_id": "TL",
       "description": "A librarian at the desk enters a few details, and the library saves one record and shows what it saved.",
       "settings": [ { "name": "required_input", "meaning": "What the librarian must enter for the action to go ahead." } ] }
pattern_add_pattern_rule { "id": "TL-PAT-LIBRARIAN-ACTION-R01", "title": "Missing input is refused", "pattern_id": "TL-PAT-LIBRARIAN-ACTION",
       "setting": "required_input",
       "statement": "When the librarian leaves out any of the required input, the library MUST refuse the action, say what is missing, and save nothing." }
pattern_following_follow_pattern { "follower_id": "TL-LEND-UC01", "pattern_id": "TL-PAT-LIBRARIAN-ACTION",
       "setting_values": [ { "setting": "required_input", "value": "The member's name and a valid email address." } ] }
```

To stop following a pattern, `pattern_following_stop_following_pattern` with the follower and the pattern: its setting values go with it.

## Rules

- Every use case has at least one actor and one UC requirement, unless all its rules come from its patterns; the check reports what is missing.
- A use case changes nothing itself: it names no aggregate and no event. What it changes follows from the commands its flows' steps invoke.
- Something undecided is a question (`product_add_question`) with an `owner` (a role, such as Owner), `about` the use case, never "TBD" in a requirement.
- Next, write each use case's flows, one per interface it happens through, with the `design-interactions` skill, then finish with `check-and-fix`.
