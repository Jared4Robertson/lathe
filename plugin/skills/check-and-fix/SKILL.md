---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings, gaps and coverage. Use after changing any Lathe spec data, before committing spec changes, when a command is refused, or when asked whether the spec is consistent or how much is designed, built and proved.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Every kind belongs to one aggregate, and every change is one of its aggregate's own commands (`use_case_add_flow_step`, `aggregate_change_entity`, ...), which refuses what breaks that aggregate's rules outright. What is left for the check is what a single command cannot settle, because records are written stage by stage: what nothing uses yet, what a later stage still owes, and whether the code backs what the tests claim.

## Run it

- With the plugin: the `check` tool. It returns every error and warning, each product's coverage with its gaps (its `products` list, `[{ root, coverage }]`, each coverage entry as in `lathe check --json`), and a last line `N errors, M warnings.`
- In a shell, from the repo root (the folder with `lathe.config.json`): `npx lathe check` in a product repo, `npm --prefix lathe run check` in the Lathe repo. It prints the same, and exits 1 on any error. Add `--json` for each product's whole workspace as JSON, `{ products: [{ root, workspace }] }`.
- A workspace (a repo whose `lathe.config.json` lists other products' folders under `products`, as the Lathe repo lists `examples/tool-library`) is checked whole: each product in its own folder, reported on its own, then the counts of them all. The commands and the tools change the product of the repo they run in: change a listed product's records with `--root` set to its folder.

Run it before you report or commit.

## When a command is refused

A refused command changed nothing. Its result lists every reason, each with the rule it broke in brackets:

- `[foreign-key]`, `[missing]`: an ID that names nothing, usually a typo. Read the record whole with its aggregate's get tool (`use_case_get_use_case`, `aggregate_get_aggregate`, ...), or list those under a parent with its list tool, to find the right one.
- `[required]`, `[type]`, `[check]`: a column missing, of the wrong type, or breaking a rule of its table, said in words (exactly one of two parents, exactly one type per field, a file for an automated test, a reason for a manual one and only for it).
- `[parent]`: the record names no parent, two, or one of a kind it may not sit under. An endpoint sits under exactly one command or query; a question under its product or one domain.
- `[primary-key]`, `[unique]`: it exists already, or its parent has its one already (one flow per use case and interface, one test per invariant, one technical record per design record, one event a policy hears, one operation a step invokes, one view it happens in).
- `[id-prefix]`: the ID does not start with its scope's ID and a hyphen: its parent's, its domain's or its product's. The aggregate's `<aggregate>_next_id` gives a right one.
- `[relation-pair]`, `[link-scope]`, `[link-crosses-product]`: a link between kinds its relation does not join, across domains where the relation stays in one (`checks`, `reads`, `selects_by`, `calls`) or across aggregates (`raises`), or across products.
- `[step-fulfills-own-use-case]`, `[policy-hears-published]`: a step fulfilling another use case's requirement, a policy hearing another domain's unpublished event.
- `[referenced]`: a removal while something still references the record; the refusal names what does. Change those records so they no longer name it, or remove them, first.
- A title refused: a duplicate within its kind and product, a trailing period, whitespace in a code-bound title, an endpoint title other than its method and route, or a check row title not in kebab case. Rename it by the naming convention in the skill that writes the kind; never add a number or a suffix just to make it unique.

A change never takes a parent column: a use case, an endpoint, a table and an open question move with their aggregate's move command (`use_case_move_use_case`, `endpoint_move_endpoint`, `table_move_table`, `product_move_question`); any other record that belongs elsewhere is removed and added again. A key never changes: a record that needs another key is removed and added again. Never renumber a record to get past a refusal.

## What each check means

Every problem names its check in brackets. `REFERENCE.md` in the Lathe package (`lathe/REFERENCE.md` in the Lathe repo, `node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains each check, Lathe's and the product's own, with how to fix what it reports; `check_list_checks` gives the same rows. Read the check's entry before you fix what it reports.

## Errors: fix them now

An error means the spec is broken. Do not leave one behind.

- **Nothing uses it.** A view no step happens in, an integration no step exchanges with, a value object no field is typed by, a specification nothing checks or selects by, a UI component that renders no view. Link what uses it, or remove it.
- **Files.** An automated test whose file is missing, or does not name the test's ID. The other way round, a test case in the code that names no test of its file (`test-case-unnamed`, with the file and line): name it with the ID of the test it proves, adding that test (and the requirement) when the spec lacks it, or delete it when it proves nothing (see `plan-tests`).
- **A pattern rule test** naming a domain that does not follow the pattern.
- Fix the record that is wrong, not the one that reports it. Never change a product's own kinds or checks to make an error go away unless the user asked for that (see `extend-the-meta-model`).

## Warnings: loose ends

- **An event a policy hears** whose event type is not delivered by outbox. An event that only feeds read models rebuilt on every load may go in process, and is not reported.
- **A test at a level its kind does not allow** (see `plan-tests`).
- **A level of the spec the wrong size**: more children of one kind than the product's `max_children` setting allows, or a capability with only one use case. Add a capability, or merge one. Do not raise `max_children` to silence the warning unless the user asks.
- **An aggregate too large**: more entities than the product's `max_entities_per_aggregate` setting allows (7 by default). Split it into smaller aggregates that each change together (see `model-a-domain`); do not raise the setting unless the user asks.

- **A title against the convention**: a test title starting with "Tests that", "Test that" or "Should"; a specification starting with A, An or The; a flow title other than its use case's title, "in" or "through", and its interface's title; a query not starting with Get, List or Find; a domain event not in the past tense (`event-tense`). Change the title with its aggregate's change command, as the skill that writes the kind says.

Fix the warnings your task is about; leave the rest and mention them.

## No exceptions

A rule is never waived, excepted or recorded as a deliberate deviation. When a record cannot meet a rule, the model is wrong: change it until it does. A command that would change a second aggregate is fixed by splitting the aggregate, or by following the second change through an event and a policy (`model-a-domain`); code that persists several aggregates is split into one repository per aggregate (`write-the-technical-spec`). Ask the Owner when the rule itself seems wrong.

## Gaps and coverage

Gaps are the "at least one" and "exactly one" a later stage still owes: a capability with no use case, a use case with no flow, a UC requirement no step fulfills, an aggregate with no root or no command, an event no command raises, an obligation with no test. They are work still to do, not errors.

The obligations are constraints, invariants, specifications, policies, domain services, UC requirements, view requirements, API requirements, pattern rules and standard rules, and a product's own obligation kinds. Coverage counts each one, per domain:

- **designed**: its implementation is specified. A UC requirement is designed once a step of each of its use case's flows fulfills it; the others once the technical record that implements them exists.
- **built**: that technical record names a file that exists. Only the specific record counts: an invariant's rule, a view requirement's UI components that `builds` it, a UC requirement's handler of what a fulfilling step invokes or adapter of an integration it exchanges with. A data model, a unique key or a UI component that only renders the view builds nothing; when one is reported not built, add the record that really builds it (`aggregate_add_rule`, a `builds` list on `ui_component_change_ui_component`), or write the code.
- **proved**: its tests exist at a level its kind allows, automated or manual. A test not automated yet is not proof. A standard rule is proved by its standard rule tests.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how, and any refused command you had to change.
3. The coverage lines for each domain you touched, as `lathe check` prints them, and the gaps and warnings your change added or cleared.
4. Any tests not automated yet that your change added, and why they wait.
