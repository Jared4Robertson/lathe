---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings, recorded exceptions, gaps and coverage. Use after changing any Lathe spec data, before committing spec changes, when a write is refused, or when asked whether the spec is consistent or how much is designed, built and proved.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Every write goes through Lathe's command layer, which refuses what breaks the model outright. What is left for the check is what a single write cannot settle, because records are written stage by stage: what nothing uses yet, what a later stage still owes, and whether the code backs what the tests claim.

## Run it

- With the plugin: the `check` tool. It returns every error and warning, the recorded exceptions, each product's coverage with its gaps (its `products` list, `[{ root, coverage }]`, each coverage entry as in `lathe check --json`), and a last line `N errors, M warnings.`
- In a shell, from the repo root (the folder with `lathe.config.json`): `npx lathe check` in a product repo, `npm --prefix lathe run check` in the Lathe repo. It prints the same, and exits 1 on any error. Add `--json` for each product's whole workspace as JSON, `{ products: [{ root, workspace }] }` (each workspace's `exceptions` list holds its recorded exceptions).
- A workspace (a repo whose `lathe.config.json` lists other products' folders under `products`, as the Lathe repo lists `examples/tool-library`) is checked whole: each product in its own folder, reported on its own, then the counts of them all. The data commands and the tools change the product of the repo they run in: change a listed product's records with `--root` set to its folder.

Run it before you report or commit.

## When a write is refused

A refused write changed nothing. Its result lists every reason, each with the rule it broke in brackets:

- `[foreign-key]`, `[missing]`: an ID that names nothing, usually a typo. `show` the record, or `list` the table with a `parent`, to find the right one.
- `[required]`, `[type]`, `[check]`: a column missing, of the wrong type, or breaking a rule of its table, said in words (exactly one of two parents, exactly one type per field, a file for an automated test, a reason for a manual one and only for it).
- `[parent]`: the record names no parent, two, or one of a kind it may not sit under. An endpoint sits under exactly one command or query; a question under its product or one domain.
- `[primary-key]`, `[unique]`: it exists already, or its parent has its one already (one flow per use case and interface, one test per invariant, one technical record per design record, one event a policy hears, one operation a step invokes, one view it happens in).
- `[id-prefix]`: the ID does not start with its scope's ID and a hyphen: its parent's, its domain's or its product's. `next_id` gives a right one.
- `[relation-pair]`, `[link-scope]`, `[link-crosses-product]`: a link between kinds its relation does not join, across domains where the relation stays in one (`checks`, `reads`, `selects_by`, `calls`) or across aggregates (`raises`), or across products.
- `[step-fulfills-own-use-case]`, `[policy-hears-published]`, `[command-change-in-domain]`: a step fulfilling another use case's requirement, a policy hearing another domain's unpublished event, a command change of the command's own aggregate or another domain's.
- `[referenced]`: a removal while something still references the record; the refusal names what does. Unlink, remove or move those first.

A record's parent columns change only with `move`. A key never changes: a row that needs another key is removed and added again. Never renumber a record to get past a refusal.

## What each check means

Every problem names its check in brackets. `REFERENCE.md` in the Lathe package (`lathe/REFERENCE.md` in the Lathe repo, `node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains each check, Lathe's and the product's own, with how to fix what it reports; `list` on the `check` table gives the same rows. Read the check's entry before you fix what it reports.

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

Fix the warnings your task is about; leave the rest and mention them.

## Recorded exceptions: deliberate, never warnings

A recorded exception is a deviation made on purpose and written down with its reason: a command that also changes another aggregate of its domain in the same transaction (a `command_change` row). It is not a problem and never counts as a warning. `lathe check` lists every one in its own **Recorded exceptions** section, after the warnings, with its command, aggregate and reason, and the app's Checks page shows them in a section of their own, so each stays visible. Read the list when you touch those commands: check each reason still holds, and prefer an event and a policy when it no longer does (then remove the row).

## Gaps and coverage

Gaps are the "at least one" and "exactly one" a later stage still owes: a capability with no use case, a use case with no flow, a UC requirement no step fulfills, an aggregate with no root or no command, an event no command raises, an obligation with no test. They are work still to do, not errors.

The obligations are constraints, invariants, specifications, policies, domain services, UC requirements, view requirements, API requirements, pattern rules and standard rules, and a product's own obligation kinds. Coverage counts each one, per domain:

- **designed**: its implementation is specified. A UC requirement is designed once a step of each of its use case's flows fulfills it; the others once the technical record that implements them exists.
- **built**: that technical record names a file that exists.
- **proved**: its tests exist at a level its kind allows, automated or manual. A test not automated yet is not proof. A standard rule is proved by its standard rule tests.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how, and any refused write you had to change.
3. The coverage lines for each domain you touched, as `lathe check` prints them, the gaps and warnings your change added or cleared, and any recorded exception you added or removed, with its reason.
4. Any tests not automated yet that your change added, and why they wait.
