# Brief: zero check warnings (LA and the Tool Library)

Read [00-common-rules.md](00-common-rules.md) and [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `main`.** Work in your own worktree from it; finish with your branch ready to merge into main (merge current main into it first, keeping both sides of any conflict; data files merge row by row through the merge driver once `lathe/` has its `node_modules`).

## Goal
The Owner wants Lathe used properly: `node lathe/bin/lathe.ts check` reports **0 errors and 0 warnings** on LA (repo root) and on `examples/tool-library`. Five agents each own a slice (your launch message names yours). Fix each warning for real:
- **not-proved:** link the test that already proves the obligation (fix its record: parent, level, file, and make the test's name start with its record ID), or write the missing test.
- **not-built:** link the technical record whose file implements it (or the flow step's invoked command or query, or the view's UI component), or write the missing code if the requirement is wanted, or remove or reword the requirement if it isn't true of Lathe.
- **not-designed:** add the flow step or link that designs it.
- **test-level-not-allowed:** move the test to the level its kind allows, or to the kind its level fits.
- **technical-file-missing:** point the record at the real file, or remove the record.
Never hide a warning: no deleting true requirements to make a number go down, no loosening a check, no waivers. If the honest fix is a model or product decision, stop and say so in your report instead.

## Decisions (Owner)
1. **Authoring is remodeled into small aggregates.** The single Product aggregate (LA-AUT-A1, 68 entities) was a design smell: the store's whole-product transaction is an implementation choice, not the domain's consistency boundary. Authoring's aggregates mirror the clusters people change together: Product (roles, settings), Pattern (rules, settings), Standard (rules), Product kind (fields, relations); Domain (terms), Aggregate (entities, fields, invariants, events, commands, policies), Value object (fields, constraints), Read model (fields, queries), Specification, Domain service; Capability, Use case (actors, requirements, flow, steps); View (requirements), Endpoint (requirements), Integration; and small aggregates for technical records and tests under what they implement or prove (choose the cleanest cut and say why). Cross-aggregate rules (links staying in scope, referenced records existing, an ID meaning one record) become specifications that Authoring's commands check, or unique keys; true invariants stay with their aggregate. "Apply several changes as one" and "Merge two branches' data" change several aggregates in one transaction: record each as a `command_change` exception with its reason. Groups (`group_name`) only where a list is still over the size limit (Authoring's terms, probably).
2. **The outbox standard is refined:** an event a policy hears is delivered by outbox (a lost reaction is a lost change). An event that only keeps read models current (fed_by), where those read models are rebuilt from the data on every load, may be delivered in process. The `event-not-by-outbox` check, its explanation, the reference, the modeling skill and LA's spec say so.
3. **Size warnings** are fixed by the model (decision 1) and by groups, never by raising `max_children`.

## Rules
- Data only through the CLI (`node lathe/bin/lathe.ts …`) or the store's functions from a one-time script you don't commit.
- Stay inside your slice's records and the code and tests they point at. If a fix needs another slice's records, say so in your report rather than editing them.
- Test names start with their record ID; one parent per test.

## Checks
lathe, app and desktop typecheck, tests and knip for what you touched; `lathe check` on both products, reporting the warnings left in your slice (target 0) and confirming 0 errors; the browser suites only if you changed app UI. Never port 5199, never push.

## Report
Warnings fixed by kind, what you implemented, linked, reworded or removed (and why for every removal), tests written, decisions, checks, and anything left that needs the Owner.
