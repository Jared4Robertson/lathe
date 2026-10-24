# Brief: IDs cited in prose are resolved

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-5`.

## Goal
S2's most common drift is a prose citation to an ID that no longer exists (re-trial recommendation 6 and probe P3). Lathe ignores record bodies today.

## Decisions
- The engine finds ID-shaped tokens in each record's body (outside code spans and fenced code blocks), using the ID pattern from FORMAT.md, and keeps only tokens that look like IDs of this workspace: they start with a product prefix that exists (the ID of a `product` record) followed by `-`, or equal one.
- `SpecRecord.mentions` (already in `lathe/src/types.ts`): the IDs it cites that exist, in order of first mention, without duplicates, excluding its own ID.
- Warning `unknown-id-in-prose`: a cited ID-shaped token with a known product prefix that is not a record ("TL-LEND-UC03 mentions TL-LEND-DR99, which does not exist").
- Mentions are not links: they do not count for coverage and are not checked against relations.

## What to do
1. In `lathe/src/index.ts`, only in record parsing and the records/mentions tables (plus `lathe/src/parse.ts` if useful): extract mentions; add a check file numbered 41.
2. `lathe/FORMAT.md`: a new section 12, "Citing records in prose".
3. Tests in a new `lathe/test/mentions.test.ts` with fixtures `lathe/test/fixtures/mentions-*` (code spans ignored, unknown prefix ignored, duplicates, own ID).
4. Fix any real `unknown-id-in-prose` warnings this finds in the repo's specs (they are real drift).
5. Lathe's own spec: use case `LA-CHK-UC13` under `LA-CHK-CAP01`, with requirements, domain rules `LA-CHK-DR70`–`DR79`, components `LA-CHK-C70`–`C79`, tests `LA-CHK-T120`–`T129`. All satisfied and proved.

## Scope
You own: record parsing and the mentions table in `lathe/src/index.ts`, `lathe/src/parse.ts`, check file 41, `lathe/FORMAT.md` section 12, the test file and fixtures above, the spec records above, and wording fixes in any `specs/**` body where a mention is stale. Others are changing `gatherFileFacts` and `loadMeta` in `lathe/src/index.ts`, other checks, `lathe/src/coverage.ts` and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
