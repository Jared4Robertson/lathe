# Brief: patterns adopted per domain, optional settings, proof-only pattern rules

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-7`.

## Goal
Third S2 trial, priorities 2, 3, 4 and 6 (notes/trials/s2-accounting.md, section 7.6; findings N2–N6). S2 adopts most patterns per domain, several have no settings, it asks only for proof of pattern rules (not design), and it lets interaction requirements and flow steps carry out pattern rules.

## The contract (committed; do not change it)
- `kinds.csv`: `pattern` no longer requires `settings`; `pattern_rule` has `obligation` value `proof` (a proof-only obligation). `Kind.proof_only` in `lathe/src/types.ts`.
- `relations.csv`: `follows` from `domain` to `pattern`; `fulfills` from `interaction_requirement` and `flow_step` to `pattern_rule`.

## What to do
1. Meta loading (`loadMeta` in `lathe/src/index.ts`, that function only): read `obligation` as `yes`/`true` (obligation), `proof` (obligation, proof only) or anything else (not), and fill `proof_only`.
2. Coverage (`lathe/src/coverage.ts`) and checks 15/16: a domain follows a pattern when the domain itself `follows` it **or** any of its use cases does. For a proof-only kind, `designed` and `built` are reported as equal to `total` (nothing is asked) and the `unsatisfied` warning does not fire; `proved`, `planned` and gaps work as before. A rule with no `setting` applies wherever its pattern is followed (as now); Not applicable still works through use-case settings when the domain follows through its use cases.
3. Checks: `30-pattern-setting-missing.sql` only applies when the pattern has settings; `17-use-case-without-requirements.sql` does not fire for a use case that follows a pattern (its rules come from the pattern); `51-flow-step-fulfills-outside-flow.sql` treats the rules of the patterns the flow's use cases (or the flow's domain) follow as inside the flow.
4. `lathe/FORMAT.md` sections 6, 10 and 11: per-domain adoption, optional settings, proof-only obligations.
5. Tests in a new `lathe/test/patterns-like-s2.test.ts` with fixtures `lathe/test/fixtures/s2patterns-*`; update existing tests only where the contract changes an expectation (for example pattern rules no longer counting as unsatisfied).
6. Tool Library: keep it valid (its pattern has settings and is followed by use cases; its pattern rules are now proof-only, so check that coverage still reads sensibly).
7. Lathe's own spec: use case `LA-CHK-UC19` under `LA-CHK-CAP03`, with requirements, domain rules `LA-CHK-DR130`–`DR139`, components `LA-CHK-C130`–`C139`, tests `LA-CHK-T220`–`T239`, and add it to `LA-CHK-F03`'s `carries_out`. Update `LA-CHK-UC10`/`UC11` records where the rules changed. All satisfied and proved; every new rule applied.
8. Plugin: `write-use-cases` (domain-level follows, settings optional) and `extend-the-meta-model` (`obligation: proof`).

## Scope
You own: `loadMeta` in `lathe/src/index.ts`, `lathe/src/coverage.ts`, checks 15, 16, 17, 30 and 51, FORMAT sections 6, 10 and 11, the test file and fixtures above, `specs/tool-library/**`, the spec records above and those plugin skills. Others change prose citations and config, new checks 53+, and `app/**` in parallel.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix examples/tool-library test`, `npm --prefix lathe run check` (0 errors).
