---
name: write-use-cases
description: Write or change Lathe use cases, their requirements, the capabilities that group them and the patterns they follow. Use when adding what an actor does with the product, splitting a use case, grouping a domain's use cases into capabilities, writing behavior several use cases share as a pattern, or stating the rules a use case must follow (and deciding which rules belong at a view or endpoint instead), in a repo with lathe.config.json.
---

# Write use cases

A use case is something an actor does with the product to reach a goal. Its requirements are the rules it must follow, one per record, each testable on its own.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists every table with its columns, their types and what each means. In a shell, `lathe add <table> --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each new record's ID from `next_id`. IDs are never reused or renumbered.

## Before you write

1. `show` the domain (its language is in its notes) and the aggregates and domain rules the use case touches. Use those terms exactly.
2. `list` the domain's use cases (`parent`: the domain) so a new one does not repeat an old one.
3. `list` the domain's capabilities, the product's patterns, and `show` the domain to see the patterns it follows. Put the use case in the capability it belongs to, and follow every pattern whose behavior it shares and that the domain does not already follow as a whole.

## The records

The app and `lathe check` call a `requirement` record a **UC requirement** (use case requirement), to tell it apart from interaction requirements and pattern rules; its table is still `requirement`.

| Kind | Parent | ID | Holds |
| --- | --- | --- | --- |
| `capability` | the domain (`domain_id`) | `<P>-<D>-CAP<nn>` | `position`: its place in the domain, a whole number, unique there. `description`: what it covers, in a sentence or two. |
| `use_case` | the domain, or one of its capabilities (`capability_id` with `domain_id`) | `<P>-<D>-UC<nn>` | `goal`: what the actor wants, in one sentence. Its actors are `use_case_actor` rows and its main steps `use_case_step` rows. `notes`: what happens when a step fails, and anything longer. Links: `applies` the domain rules it relies on; `follows` the patterns it shares. |
| `use_case_actor` (part) | the use case | its `position` | `role_name`: one of the product's roles (see Roles). |
| `use_case_step` (part) | the use case | its `position`, 1, 2, 3 | `description`: one step of the main course. |
| `requirement` | the use case (`use_case_id`) | `<use case>-R<nn>` | Title: the rule in a few words. `statement`: the rule in one sentence with MUST / MUST NOT / SHOULD / MAY. `group_name`: a short heading it is shown under, such as Validation or Paging. |
| `pattern` | the product (`product_id`) | `<P>-PAT-<NAME>`, a name you choose | `description`: the shared behavior. `notes`: how a use case or domain uses it. Its settings are `pattern_setting` rows and its rules `pattern_rule` records. |
| `pattern_setting` (part) | the pattern | its `position` | `name`: lower case with underscores; `meaning`: what each follower decides. |
| `pattern_rule` | the pattern (`pattern_id`) | `<pattern>-R<nn>` | `statement`; `setting`, a setting the rule depends on; the applies-when columns (see Patterns). |
| `setting_value` (part) | the follower (`follower_id`) | `pattern_id` and `setting` | `value`, or `not_applicable` with the reason. |

Once a use case has more than about 8 requirements, or a pattern more than about 8 rules, sort them into groups with `group_name`, a short heading such as Validation, Paging or Errors. The app shows the ungrouped ones first, then each group under its heading, and `too-many-children` counts each group as its own list. Give every group at least two members (a group of one is a `lone-child` warning). A group is a column, so moving a record into one changes no ID.

## Roles

A use case's actors name roles, never people: Member or Librarian in the Tool Library; Owner, Reader or Agent in Lathe's own specs. The product's roles are `role` rows (`product_id`, `name`, `description`); `list` them, and an actor must be one of them. If a new role is needed, `add` it with a description of what the role does. Write the same roles in prose: "the librarian", "the owner".

## Capabilities

Once a domain has more than a handful of use cases, group them into ordered capabilities, such as 01 Membership, 02 Catalog, 03 Lending. A capability is a slice through Define and Design: put the domain's flows and acceptance tests under the same capability as the use cases they carry out and prove. Domain rules stay under their aggregates, and tests that prove only domain rules may stay under the domain.

- Put a use case, flow or test into a capability with `move` (`parent`: the capability). Its ID never changes.
- Once a domain has one capability, every use case of the domain belongs in one; a use case left under the domain is a warning.
- The domain's use case index (capability, use case, pattern, in capability order) comes from the data; do not keep a hand-written copy.

## Patterns

When two or more use cases would state the same rules, write those rules once as a pattern and let each use case follow it. A setting is what each use case decides differently, such as the record it saves or the permission it needs. A pattern that every use case applies the same way, such as API conventions, has no settings.

When a pattern applies to a whole domain, link the **domain** to it with `follows`. The domain then owes every rule of the pattern, and its use cases need not follow it one by one. A domain is never asked for settings; it may give them as `setting_value` rows of its own, which only a rule's applies-when reads. When the use cases decide a pattern's settings differently, let them follow it and give them.

- A use case that `follows` a pattern with settings gives every setting as a `setting_value` row: a `value`, or `not_applicable` with the reason. A missing setting is an error.
- The use case's requirements do not restate the pattern's rules. Write a requirement only for what this use case adds; a use case whose rules all come from its patterns may have none.
- Avoid two patterns with the same setting name: a use case following both gives one value for both (a warning). Rename one of the settings.
- Do not make a pattern for one use case. If only one use case has the behavior, it is that use case's requirements.
- A rule you prove with tests is a pattern rule; a rule about how the code is written that you follow and cite, such as logging or naming, is a standard rule (see `design-the-domain`).
- Every domain that follows the pattern, itself or through any of its use cases, owes each of its rules: a test in that domain `proves` it. Pattern rules need proof only by default, so no component has to `satisfy` one, though a component may, to say which code carries it out. A rule whose `setting` all of a domain's following use cases mark not applicable is not owed there, unless the domain itself follows the pattern. A rule with no `setting` is owed wherever the pattern is followed.
- A rule that holds only for some values of a setting says so with `applies_when_setting`, `applies_when_value` and `applies_when_negated` (false for "is", true for "is not"), such as scope is not single; give all three or none. It is owed in a domain only when at least one follower there gives that setting a value that meets it, compared trimmed and in any letter case; elsewhere it is waived, neither owed nor proved, and the app shows "Waived here". Use applies-when when a use case's value decides it, and `not_applicable` when the setting does not apply at all.
- An interaction requirement or a flow step may `fulfills` a pattern rule, to say where it is carried out. A step may fulfill only the rules of the patterns its flow's use cases or its domain follow.

## Example

A use case in a capability, with its actor, steps and the rules it applies, and one requirement:

```
add  { "use_case": { "id": "TL-LEND-UC03", "title": "Borrow a tool", "domain_id": "TL-LEND", "capability_id": "TL-LEND-CAP03",
       "goal": "A member borrows an available tool for the loan period." } }
add  { "use_case_actor": { "use_case_id": "TL-LEND-UC03", "position": 1, "role_name": "Member" } }
add  { "use_case_step": { "use_case_id": "TL-LEND-UC03", "position": 1, "description": "The member picks a tool from the catalog." } }
add  { "use_case_step": { "use_case_id": "TL-LEND-UC03", "position": 2, "description": "The library checks the member can borrow and the tool can be lent." } }
add  { "use_case_step": { "use_case_id": "TL-LEND-UC03", "position": 3, "description": "The library records the loan and tells the member when it is due." } }
link { "source": "TL-LEND-UC03", "relation": "applies", "target": "TL-LEND-DR06" }

add  { "requirement": { "id": "TL-LEND-UC03-R02", "title": "An unavailable tool is refused with the reason", "use_case_id": "TL-LEND-UC03",
       "statement": "Borrowing MUST be refused when the tool is on loan or needs repair, and the response MUST say which." } }
```

A capability, a pattern with a setting and a rule, and a use case that follows it:

```
add  { "capability": { "id": "TL-LEND-CAP01", "title": "Membership", "domain_id": "TL-LEND", "position": 1,
       "description": "Who may borrow: a librarian registers a person as a member." } }

add  { "pattern": { "id": "TL-PAT-LIBRARIAN-ACTION", "title": "Librarian action", "product_id": "TL",
       "description": "A librarian at the desk enters a few details, and the library saves one record and shows what it saved." } }
add  { "pattern_setting": { "pattern_id": "TL-PAT-LIBRARIAN-ACTION", "position": 1, "name": "required_input",
       "meaning": "What the librarian must enter for the action to go ahead." } }
add  { "pattern_rule": { "id": "TL-PAT-LIBRARIAN-ACTION-R01", "title": "Missing input is refused", "pattern_id": "TL-PAT-LIBRARIAN-ACTION",
       "setting": "required_input",
       "statement": "When the librarian leaves out any of the required input, the library MUST refuse the action, say what is missing, and save nothing." } }

add  { "use_case": { "id": "TL-LEND-UC01", "title": "Register a member", "domain_id": "TL-LEND", "capability_id": "TL-LEND-CAP01",
       "goal": "A librarian registers a person so they can borrow." } }
add  { "use_case_actor": { "use_case_id": "TL-LEND-UC01", "position": 1, "role_name": "Librarian" } }
link { "source": "TL-LEND-UC01", "relation": "follows", "target": "TL-PAT-LIBRARIAN-ACTION" }
add  { "setting_value": { "follower_id": "TL-LEND-UC01", "pattern_id": "TL-PAT-LIBRARIAN-ACTION", "setting": "required_input",
       "value": "The member's name and a valid email address." } }
```

Add the `follows` link before its `setting_value` rows: a setting value needs the link. To stop following a pattern, `remove` the setting values first, then `unlink`.

## Rules

- A requirement does not restate a domain rule; the use case `applies` the rule instead. Write a requirement only for what this use case adds: an order of checks, what the actor sees, what is refused and how.
- A requirement says what, not how. Screens, routes and code belong to the design (see `design-the-domain`).
- A rule that only makes sense at one screen, endpoint or flow is an **interaction requirement** under that view, endpoint or flow, not a use case requirement. Examples: a field's type and limits, the status and error code of a refusal, what a success response returns, which button is disabled. Keep the use case requirement for what the actor must be able to do or must be refused ("an unavailable tool is refused with the reason"), and let the interaction requirement say how that shows at the endpoint ("POST /loans answers 409 tool_on_loan") and `fulfills` it. Test: if the rule names a route, a status code, a field limit or a screen element, it belongs in the design.
- Every use case needs at least one requirement; one with none is a warning.
- Something undecided is a `question` with an `owner` (a role, such as Owner), linked with `about` to the use case, never "TBD" in a requirement.
- Finish with the `check-and-fix` skill.
