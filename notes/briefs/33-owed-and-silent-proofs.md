# Brief: name owed proofs, and report proofs that count nowhere

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-7`.

## Goal
Third S2 trial, priorities 5 and 7 (notes/trials/s2-accounting.md, section 7.6; findings N8, N10, P7, P9, P18): coverage counts proof still owed (`planned_any`) but never says which obligations; a test whose proof counts in no domain is silent; a manual test whose `run_by` file never mentions it is silent.

## What to do
1. New warning checks (numbered 53 onwards):
   - `proof-still-owed`: an obligation already proved that a planned test is also meant to prove ("TL-LEND-E06-R03 is proved, but planned test TL-LEND-T30 still owes a proof"), so the owed list is named, as S2 lists pattern proofs still needed.
   - `proof-counts-nowhere`: a test whose every `proves` target is counted in no domain (for example a pattern rule of a pattern no domain follows, or an obligation outside every domain).
   - `manual-test-file-silent`: a manual test whose `run_by` file exists but names neither its ID nor any ID it proves (nor its `key`).
2. `lathe/FORMAT.md`: add these three to section 5's warning list (append to the list; another agent edits sections 6, 10 and 11).
3. Tests in a new `lathe/test/owed-and-silent.test.ts` with fixtures `lathe/test/fixtures/owed-silent-*`.
4. Fix or accept what the new warnings find in the repo's specs (say which in your report).
5. Lathe's own spec: use case `LA-CHK-UC20` under `LA-CHK-CAP02`, with requirements, domain rules `LA-CHK-DR140`–`DR149`, components `LA-CHK-C140`–`C149`, tests `LA-CHK-T240`–`T259`, and add it to `LA-CHK-F02`'s `carries_out`. All satisfied and proved; every new rule applied.
6. Plugin: the three warnings in `plugin/skills/check-and-fix/SKILL.md` (append a section).

## Scope
You own: check files 53 onwards, FORMAT section 5's warning list, the test file and fixtures above, the spec records above and that plugin skill. Others change `loadMeta`, coverage, prose citations, config, checks 15–17, 30, 51 and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
