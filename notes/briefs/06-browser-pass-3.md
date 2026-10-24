# Brief: browser, pass 3 (built coverage, fitness, Browsing tests)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Show the new coverage and fitness data in the web app, and prove the Browsing domain's requirements with tests, so Lathe's coverage for `LA-BRW` is full.

## Decisions already made (by Jared)
- **LA-BRW-Q01 Read-only:** the spec pages stay read-only. Records change in files, by a person or an agent, and are reviewed in git. (The Diagrams pages keep their existing "New diagram" form.)
- **LA-CHK-Q02:** coverage now has designed (`*_satisfied`), built (`*_built`) and proved counts. Show all three wherever coverage appears. The engine is adding the built counts in parallel; until then they are missing from `/api/spec`, so treat a missing count as unknown and show "not yet measured", never as zero.
- **LA-Q01 Fitness:** a product may have `fitness` records (date, score 1 to 5, body). The product page shows the latest fitness score with its date and body, and the history, plus a short "Evidence" panel of signals the page can count (coverage, open questions, errors and warnings), clearly separate from the score. With no fitness record, it says so and explains how to add one (link to the format section).

## Scope
- Read first: `lathe/src/types.ts`, `lathe/FORMAT.md` (sections 6 to 8), all of `app/`, and everything under `specs/lathe/browsing/`.
- You own: `app/**` and `specs/lathe/browsing/**`.

## What to do
1. Implement the UI changes above. Add `fitness` records to the sample fixture only if you own it; you do not, so put a fixture of your own under `app/test/fixtures/`.
2. Set up component tests in `app/`: vitest with jsdom and `@testing-library/react`. Test the routing, the product, domain, record and checks pages, search, links both ways, the fixture source note, and the fitness and coverage displays, against fixture data.
3. In `specs/lathe/browsing/`: remove `Q01` and write its answer into the records it affects. Add test records (`LA-BRW-T01` onwards) for your tests, so every `LA-BRW` requirement and rule is proved; update component `file` fields if files moved. Add a requirement for fitness display and one for built coverage, satisfied and proved.
4. Do not run the dev server on 5199. If you need to look at the app, run `LATHE_SPEC_FIXTURE=1 npx vite --port 5350` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (its `LA-BRW` line should show full coverage).
