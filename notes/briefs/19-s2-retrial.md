# Brief: re-run the S2 trial on the pass-4 engine

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Measure how far pass 4 closed the gaps the first S2 trial found. Pass 4 added: coverage driven by the meta-model (obligation kinds, relation roles), the `interaction_requirement` kind, test states (automated, manual, planned) with proof by the proved record's ID, and extensions that widen default kinds. See `lathe/FORMAT.md` sections 4, 6 and 9 and `notes/trials/s2-accounting.md` (the first trial's report).

## Confidentiality (unchanged)
S2_sandbox is a client product. Work outside the repo, in the first trial's folder `/private/tmp/claude-501/s2-accounting-trial/` (copy it to a new sibling folder, such as `s2-accounting-trial-pass4/`, and work there, keeping the first one as it is). Read S2 read-only; never open any `.env*` file. The repo gets only the findings, naming structures, kinds, ID patterns and counts, never requirement text, business rules, or client or partner names.

## What to do
1. Rework the trial's records for the new format: S2's view and API requirements as `interaction_requirement` records; rule tests with no separate test ID (their code names the rule's ID); tests S2 has not automated as `manual` or `planned`; and replace extension workarounds with widening where the defaults now allow it (for example a domain rule directly under a domain). Remove extension kinds or relations the defaults now cover.
2. Run the check (`node <repo>/lathe/bin/lathe.ts check --root <trial folder>`) and compare its coverage, per obligation kind, with S2's own traceability for the same slice, as the first report did.
3. Add a section "Pass 4 re-run" to `notes/trials/s2-accounting.md`: which of the first report's 11 recommendations are now done, partly done or still open; the new check result and coverage table; anything new that broke or is still awkward; and an updated, prioritised list of what to change next.

## Scope
You own `notes/trials/**` in the repo and your new scratch folder.

## Checks
The trial's `lathe check` result, and `git status` showing nothing changed outside `notes/trials/`.
