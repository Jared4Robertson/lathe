# Brief: structural warnings, relation widening, and fewer cascaded errors

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-5`.

## Goal
Three items from the S2 re-trial's list (notes/trials/s2-accounting.md, section 6.6: 4, 6 and 8). The default S2 relations (5) are already in `lathe/meta/relations.csv`.

## What to do
1. **Structural warnings** (check files numbered 42 onwards): `rule-not-applied` (a domain rule no use case applies), `use-case-without-flow` (a use case no flow `carries_out`, only in a domain that has flows), `interaction-requirement-fulfills-nothing`, and `test-type-mismatch` (a test whose `test_type` is `domain_rule`/`unit` proving only requirements, or `acceptance` proving only domain rules; keep it conservative). Warnings, with clear messages.
2. **Relation widening** in `loadMeta` (in `lathe/src/index.ts`, that function only): a relation row in an extension with the same relation, source kind and target kind as an existing row is the same rule; a non-empty `role` or `description` in the extension replaces the default's. Duplicates within one folder stay `meta-duplicate-relation`, whose message must name the folder. Update `lathe/FORMAT.md` section 9.
3. **Cascaded errors:** when an ID is duplicated, do not also report `dangling-link`, `relation-not-allowed` or `unknown-parent` errors that are only consequences of that duplicate; when a parent is unknown, do not also report `parent-kind-not-allowed` for it. One real error should give one message (probe P5 turned 1 into 16).
4. Tests in a new `lathe/test/structure.test.ts` with fixtures `lathe/test/fixtures/structure-*`.
5. Run the check on the repo: the new warnings will find real gaps in Lathe's and the Tool Library's specs (for example use cases with no flow). Fix them in the specs (add the missing `carries_out` links or flows, `applies` links, and so on), or, where a warning is wrong, make the check more precise.
6. Lathe's own spec: use case `LA-CHK-UC14` under `LA-CHK-CAP03`, with requirements, domain rules `LA-CHK-DR80`–`DR89`, components `LA-CHK-C80`–`C89`, tests `LA-CHK-T130`–`T149`. All satisfied and proved.
7. Plugin: add the new warnings to `plugin/skills/check-and-fix/SKILL.md` (append a short section; another agent edits other parts of that file) and the new relations to `plugin/skills/design-the-domain/SKILL.md`.

## Scope
You own: `loadMeta` in `lathe/src/index.ts`, check files 01–13, 17–32 and new files 42 onwards (not 14, 15, 16, 33–41), `lathe/FORMAT.md` sections 5 and 9, the test file and fixtures above, the spec records above, spec fixes for the new warnings (but not the pattern rules under `specs/tool-library/patterns`, which another agent is writing), and the plugin files named above. Others are changing `gatherFileFacts`, record parsing, coverage and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
