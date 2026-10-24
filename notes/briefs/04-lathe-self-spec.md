# Brief: Lathe's own specification (dogfooding)

Read [00-common-rules.md](00-common-rules.md) first.

## Goal
Describe Lathe in Lathe, so the tool is held to its own process: the domain model and use cases of Lathe itself, and a design that points at Lathe's real code and tests. Where Lathe's design is unsettled, record open questions rather than inventing answers.

## Scope
- Read first: `NOTES.md` (the thinking so far, including the people/tools foundation and the decisions log), `lathe/FORMAT.md`, `lathe/meta/*.csv`, `notes/briefs/01-engine.md` and `notes/briefs/03-spec-browser.md` (what is being built in parallel, with file names), `app/server/model.ts`, `app/src/App.tsx`, `app/src/layout.ts`, `model/README.md`, `model/checks.sql`.
- You own: `specs/lathe/**`.
- Out of scope: any code, and any other product's specs.

## What to write
Product `LA` with three domains:
- `LA-MOD` Modelling: diagrams (the `model/` CSV diagrams and the app's Diagrams pages) and spec records (the Markdown record format).
- `LA-CHK` Checking: loading the workspace, the meta-model, checks and coverage (the engine).
- `LA-BRW` Browsing: the web app's navigation of diagrams and specs.

For each domain: aggregates and domain rules (for example Record, Link, Kind, Relation rule, Check, Problem, Diagram), use cases with actors (Jared, an AI agent) and requirements, and a design with components whose `file` fields name real or planned files (`app/server/model.ts`, `app/src/App.tsx`, `app/src/layout.ts`, `lathe/src/index.ts`, `lathe/checks/`, `app/server/spec.ts`, and so on). Components for files that do not exist yet are fine; they show as warnings.

Tests: the engine agent is writing these tests in `lathe/test/checks.test.ts` with exactly these names. Create one `test` record for each, in `LA-CHK`, with that ID and title, `test_type: unit`, `run_by: lathe/test/checks.test.ts`, and `proves` links to the requirements or rules each one proves:
- `LA-CHK-T01` Duplicate IDs are reported as errors
- `LA-CHK-T02` A link to a missing record is reported as an error
- `LA-CHK-T03` A disallowed relation is reported as an error
- `LA-CHK-T04` A test whose run_by file lacks its ID is reported as an error
- `LA-CHK-T05` Coverage counts satisfied and proved requirements
- `LA-CHK-T06` A malformed record file becomes a parse error, not a crash

Other requirements will have no test yet; leave them unproved (they show as coverage gaps, which is honest). Add open questions with `owner: Jared` for real undecided points, such as how diagrams and spec records relate, whether the meta-model should be editable from the app, and how Fitness (from the foundation) would be measured for Lathe.

## Checks to run
The engine is not in your branch, so check the format yourself: unique IDs, correct parents and kinds, only links allowed by `relations.csv`. A throwaway script outside the repo is fine; do not commit it.
