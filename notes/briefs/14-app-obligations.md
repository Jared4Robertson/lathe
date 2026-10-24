# Brief: show every obligation kind and test state in the spec pages

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Coverage now has one row per obligation kind (`Coverage.obligations` in `lathe/src/types.ts`), including interaction requirements and any kind a product adds, and tests have a state (automated, manual, planned). Show this in the spec pages.

## What to do
1. Wherever coverage is shown (product page cards, domain page, evidence panel), show one bar group per obligation kind from `Coverage.obligations`, labelled with the kind's label, with designed, built, proved and planned. Until the engine fills `obligations` (another agent is doing it in parallel), fall back to the existing `requirements_*` and `rules_*` fields.
2. Domain page: list interaction requirements nested under their view, endpoint or flow; show each test's state as a small tag (automated, manual, planned); a planned test should look clearly unfinished.
3. Record page: show a test's state; for an interaction requirement, show what it fulfills.
4. Tests (vitest + testing-library, as set up in `app/test/`), and Lathe's own spec in `specs/lathe/browsing/` using only use case `LA-BRW-UC30` with its requirements, domain rules `LA-BRW-DR30`–`DR39`, components `LA-BRW-C30`–`C39`, tests `LA-BRW-T80`–`T99`. All new obligations satisfied and proved.

## Scope
You own: `app/src/specs/**`, `app/test/` files you add (not `app/test/graph/**`), `app/src/styles.css` (append a marked section only), and the spec records above. Another agent is changing `app/src/graph/**` in parallel; do not touch it. Never use port 5199; if you look at the app, use `npx vite --port 5380` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
