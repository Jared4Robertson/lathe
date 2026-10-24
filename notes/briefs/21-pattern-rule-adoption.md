# Brief: pattern rules proved by every domain that follows the pattern

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-5`.

## Goal and decision (decided for Jared, LA-CHK-Q10)
A pattern's rules become records, and every domain that follows the pattern must design and prove each of them, as S2's "Patterns we follow" tables do.
- `pattern_rule` (in `lathe/meta/kinds.csv`): parent `pattern`, obligation. Optional field `setting`: the pattern setting the rule depends on.
- A domain **follows** a pattern when any of its use cases `follows` it.
- For each following domain, each rule of the pattern is an obligation **of that domain**: designed when a component in that domain `satisfies` it, built when that component's file exists, proved when an automated or manual test in that domain `proves` it, planned when only a planned test there does.
- **Not applicable:** when the rule names a `setting` and every use case in the domain that follows the pattern marks that setting `Not applicable:` with a reason, the rule does not apply in that domain and is not counted there.
- A pattern rule is never counted in no domain at all; a pattern nobody follows has no coverage, and that is reported (warning `pattern-not-followed`).
- Any other obligation that sits outside every domain is reported (warning `obligation-outside-domain`), never silently dropped.

## What to do
1. Coverage (`lathe/src/coverage.ts`): add pattern rules per following domain as above, as one more obligation kind line per domain (`pattern_rule`), with gaps naming the rule; keep everything else as it is.
2. Checks (numbered from 33): `pattern-rule-setting-unknown` (error: the rule's `setting` is not one of its pattern's settings), `pattern-not-followed` (warning), `obligation-outside-domain` (warning), and make `unsatisfied` and `unproved` report a pattern rule per domain that owes it ("TL-PAT-X-R01 is not proved in TL-LEND").
3. `lathe/FORMAT.md`: a new section 11, "Pattern rules", with an example; adjust section 6 for pattern rules.
4. Tool Library: turn the two rules in `specs/tool-library/patterns/PAT-librarian-action.md` into `pattern_rule` records (`TL-PAT-LIBRARIAN-ACTION-R01`, `R02`), with the `setting` field where a rule depends on one; satisfy and prove them in `TL-LEND` with real tests in `examples/tool-library`; keep full coverage.
5. Tests in a new `lathe/test/pattern-rules.test.ts` with fixtures `lathe/test/fixtures/pattern-*` (two domains following one pattern, one proving and one not; a Not applicable domain; an unknown setting; an unfollowed pattern; an obligation outside any domain).
6. Lathe's own spec: answer and remove `LA-CHK-Q10` (write the decision into records); add use case `LA-CHK-UC11` under `LA-CHK-CAP02`, with requirements, domain rules `LA-CHK-DR50`–`DR59`, components `LA-CHK-C50`–`C59`, tests `LA-CHK-T90`–`T109`. All satisfied and proved.

## Scope
You own: `lathe/src/coverage.ts`, `lathe/checks/` new files 33–39 and `15-unsatisfied.sql`, `16-unproved.sql`, `lathe/FORMAT.md` (section 6 and a new section 11 only), the test file and fixtures above, `specs/tool-library/**`, `examples/tool-library/**`, and the spec records above. Others are changing `lathe/src/index.ts` (file facts, record parsing, meta loading), other check files and `app/**` in parallel: do not touch them; if you need an engine change elsewhere, describe it in your report.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix examples/tool-library test`, `npm --prefix lathe run check` (0 errors).
