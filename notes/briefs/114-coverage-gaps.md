# Brief: zero coverage gaps (LA and the Tool Library)

Read [00-common-rules.md](00-common-rules.md), [113-zero-warnings.md](113-zero-warnings.md) (same approach) and [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `main`.** Work in your own worktree from it; finish with your branch ready to merge into main (merge current main into it first, keeping both sides of any conflict).

## Goal
`node lathe/bin/lathe.ts check` already reports 0 errors and 0 warnings on LA and the Tool Library. It also lists coverage gaps: records short of a minimum (149 on LA, 8 on the Tool Library). Clear them for real, keeping 0 errors and 0 warnings. Your launch message names your part.

## Decisions (Owner, by the coordinator's recommendation)
1. **Recorded change counts as a command.** An aggregate meets "has a command" when a command changes it directly, or through a recorded exception (`command_change`). Lathe's writes are generic; no per-aggregate commands are invented.
2. **Every stored thing names its storage.** Table storage gains `browser storage` and `in memory` beside `table`, `view` and `materialized view`. An entity or read model that isn't in a database still gets a table record naming where it lives (for example Exploring's tabs in session storage, read models computed in memory on each load). Keys are asked only of `table` storage. An entity's table may be `table` or `browser storage`; a read model's any of them.
3. **Flow tests are automated where they can be:** a flow driven through the CLI or MCP is an `e2e-api` test that runs the flow's steps through the real CLI; a flow in the app is an `e2e-ui` test in the stability harness (Playwright, one worker); `manual` only where a step needs the operating system or a person (say why in the manual reason). One flow test per flow, named by its record ID, walking the main path.
4. Everything else is closed by stating the truth: a value object lists its one or more fields; an event gets its event type pointing at the code that shapes it; an entity its data model; an aggregate its repository; a read model its projection and query, all pointing at the real code. If the honest answer is that a record shouldn't exist, remove it and say why.

## Rules
Data only through the CLI or the store's functions from an uncommitted script. Test names start with their record ID. Never port 5199, never push, quit every process you start.

## Checks
Typecheck, tests and knip for what you touched; `lathe check` on both products with 0 errors, 0 warnings and the gaps left in your part (target 0); the stability suite once with one worker if you added or changed browser tests.

## Report
Gaps closed by kind, records added or removed (why for each removal), tests written, decisions, checks with results.
