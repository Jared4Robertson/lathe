# Brief: read the citations a product actually writes

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-7`.

## Goal
Third S2 trial, priority 1 (notes/trials/s2-accounting.md, section 7.6, finding N1): prose citations are read only when an ID starts with a product's ID, so they never work for S2 (`ACC-`, `STD-`, `SYS-`), and a bare product ID such as "S2" in a body counts as a citation, which makes noise everywhere.

## Decisions
- A token is a citation when it **is the ID of an existing record**, or when it starts with a **known ID prefix** followed by `-`. Known prefixes: every product's ID, every domain's ID, plus an optional `idPrefixes` list in `lathe.config.json` (for example `["STD", "SYS"]`).
- A bare product or domain ID on its own (`TL`, `S2`, `TL-LEND`) is a citation only when it is written as a lone-ID code span; in plain prose it is not (too common as an ordinary word).
- `unknown-id-in-prose` fires only for tokens with a known prefix that are not records.

## What to do
1. Implement in `lathe/src/config.ts` (`idPrefixes`) and the prose-citation part of `lathe/src/index.ts` (`readProseCitations` and its tables) and `lathe/src/parse.ts` if needed; update `lathe/FORMAT.md` sections 12 and the config description in `lathe/README.md`.
2. Tests: a new `lathe/test/citations-by-id.test.ts` with fixtures `lathe/test/fixtures/citations-*`; update `lathe/test/mentions.test.ts` only where the new rule changes an expectation.
3. Fix any new real `unknown-id-in-prose` warnings in the repo's specs.
4. Lathe's own spec: use case `LA-CHK-UC18` under `LA-CHK-CAP01`, with requirements, domain rules `LA-CHK-DR120`–`DR129`, components `LA-CHK-C120`–`C129`, tests `LA-CHK-T210`–`T219`, and add it to `LA-CHK-F01`'s `carries_out`. Update `LA-CHK-UC13`'s records where the rule changed. All satisfied and proved; every new rule applied.

## Scope
You own the files above. Others change coverage, checks 15–17, 30, 51 and new checks 53+, and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run check` (0 errors).
