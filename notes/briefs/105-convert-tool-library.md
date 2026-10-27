# Brief: convert the Tool Library to the new model (step 2)

Read [00-common-rules.md](00-common-rules.md) and the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md) first. **Base branch: `domain-model`**, the integration branch for this hard cutover, not `main`. Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
The Tool Library (`examples/tool-library/`) is Lathe's example product and the worked example for this cutover. Convert its spec into the plan's fifty kinds, completely and faithfully, so the Owner can review the new model on a real product before LA is converted the same way. The conversion is judgment work: sorting rules, splitting use cases into commands, queries and flow steps, and finding what the code actually implements.

This brief runs in **two phases**. Phase A starts now, beside the schema step (brief 104). Phase B starts when the coordinator messages you that the schema has merged into `domain-model`.

## Phase A: the sorting sheet (now)
Read the Tool Library's data (`examples/tool-library/data/*.jsonl`), its code (`src/`, `test/`) and its README. Write `notes/conversions/tool-library.md`: the complete new spec, as tables per kind in the plan's order, each row with its new ID (the plan's ID patterns), title, parent, links and fields, and the old record or code it comes from. In particular:
- **Rules:** sort each domain rule into a constraint (and its value object), an invariant, a specification or a policy (the DDD reaction), by what it does. Uniqueness across records is an invariant with a unique key.
- **Use cases:** keep each use case as the actor's goal, with its requirements. Find its commands and queries in the code, put each command under the one aggregate it changes and each query under the read model it reads, and write its flow's steps: each fulfills its requirements, invokes at most one command or query, and happens in a view if it has one.
- **Events and policies:** what each command raises, and any reaction as a policy under the command it invokes.
- **Value objects** for emails, dates, conditions and the like, with their constraints; entity fields typed by them, by basic types or as references to aggregates.
- **Read models and tables:** a table per entity (storage `table`, keys from the code's SQLite schema, unique keys naming their invariants) and per read model (usually `view`).
- **Endpoints and API requirements:** each endpoint under the command or query it exposes; today's endpoint rules become API requirements.
- **Technical kinds** for what the code really has, each naming its file: repositories, data models, value types, predicates, event types, projections, command and query handlers, event handlers, services, endpoint handlers. Where the code has none (for example no projection), leave it out; it shows as not built.
- **Tests:** split each test by what it proves into the new test kinds, under one parent each, with its run by. A test that proved two things becomes two test records; both may name the same test file.
- **Glossary terms** for the domain's language, the domain's subdomain type, and domain services if the code has domain logic that belongs to no single entity.
- **Accounted for:** a closing table maps every old record and link to where it went, or why it was dropped. Nothing is dropped silently.

Commit the sheet and report: counts per new kind, every judgment call, and anything that didn't fit the plan. Then stop and wait for the coordinator's message.

## Phase B: apply it (after the schema merges)
1. Merge `domain-model` into your branch.
2. Replace the Tool Library's `data/` with the new spec, written only through the command layer: the `lathe` CLI from `lathe/bin/lathe.ts` (or the store's command functions from a one-time script you run and don't commit). Delete the old data files of removed tables.
3. Update the Tool Library's code and docs for the new IDs: source files that name their component record now name their technical record; test names start with their new test record ID; the README describes the new spec, `data/` (not `specs/`) and the test files.
4. Check: the data loads with every constraint; `npm --prefix examples/tool-library test` and `npm --prefix examples/tool-library run typecheck` pass. The engine's checks and the app are rewritten in a later step, so `lathe check` and the app aren't expected to work yet; don't run them.
5. Update the sheet to match what you wrote, commit, and report.

## Owns
`examples/tool-library/` (data, code, tests, README) and `notes/conversions/tool-library.md`. Don't touch `lathe/`, `app/`, `desktop/`, the plugin, LA's `data/` or other notes.

## Report
Follow the common rules' report, plus counts per kind, every judgment call, anything the plan didn't cover, and any change you need in the schema.
