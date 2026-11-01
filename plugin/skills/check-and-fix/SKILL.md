---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings, recorded exceptions, gaps and coverage. Use after changing any Lathe spec data, before committing spec changes, when a write is refused, or when asked whether the spec is consistent or how much is designed, built and proved.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Each command refuses what breaks its aggregate's rules outright, so what is left for the check is what one command cannot settle: what nothing uses yet, what a later stage still owes, and whether the code backs what the tests claim.

Run the `check` tool (in a shell, `npx lathe check`, or `npm --prefix lathe run check` in the Lathe repo; it exits 1 on any error). Run it before you report or commit. Each problem names its check; `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains every check and how to fix what it reports. Read the entry before you fix.

## When a command is refused

A refusal changed nothing and lists every reason, each with the rule it broke. Read the reasons; they say what to fix. Judgment on the usual ones:

- A key never changes and a change never takes a parent column. A record that needs another key or another parent is removed and added again, or moved with its aggregate's move command where there is one. Never renumber a record to get past a refusal.
- A title refused for a duplicate, a trailing period or whitespace: rename it by the naming convention of the skill that writes the kind. Never add a number or suffix just to make it unique.
- A removal refused because something references the record: change or remove those records first.
- Fix the record that is wrong, not the one that reports it.

## Errors and warnings

An error means the workspace is broken; do not leave one behind. Fix the warnings your task is about, leave the rest and mention them. Do not raise a size setting (`max_children`, `max_entities_per_aggregate`) to silence a warning unless the Owner asks: split or merge instead.

Never change a product's own kinds or checks to make an error go away unless asked (`extend-the-meta-model`).

## No exceptions

A rule is never waived or recorded as a deliberate deviation. When a record cannot meet a rule, the model is wrong: change it until it does. A command that would change a second aggregate is fixed by splitting the aggregate, or by following the second change through an event and a policy (`model-a-domain`). Ask the Owner when the rule itself seems wrong; a standard is the Owner's to change.

## Gaps and coverage

Gaps are the "at least one" and "exactly one" a later stage still owes. They are work to do, not errors. Coverage counts obligations per domain:

- **designed**: its implementation is specified.
- **built**: every specific technical record that implements it names a file that exists, and there is at least one. A data model, a unique key or a component that only renders a view builds nothing; when something is reported not built, add the record that really builds it or write the code.
- **proved**: its tests exist at a level their kind allows, automated or manual. A test not automated yet is not proof.

## Report

Say, in a few lines: whether the check passes (the last line); each error you fixed and how; the coverage for each domain you touched and the gaps and warnings your change added or cleared; and any tests not automated yet that you added, and why they wait.
