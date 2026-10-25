# Brief: third S2 trial, after passes 5 and 6

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `trial-3`.

## Goal
Measure how far passes 5 and 6 closed the gaps from the second trial (`notes/trials/s2-accounting.md`, section 6, especially its priority list in 6.6 and findings A to H). Pass 5 added: pattern rules owed by every domain that follows the pattern, every proof claim checked (with an optional `key`), IDs cited in prose, structural warnings, relation widening, fewer cascaded errors, and default S2 relations (`carries_out`, `runs`, `covers`, `fulfills` from flows). Pass 6 added: a product's own checks (`checks` in `lathe.config.json`), `planned_any` and tests by state in coverage, and `flow_step` records. See `lathe/FORMAT.md` sections 4–14.

## Confidentiality (unchanged)
S2_sandbox is a client product. Copy the second trial's folder `/private/tmp/claude-501/s2-accounting-trial-pass4/` to a new sibling `s2-accounting-trial-pass6/` and work there, leaving the others as they are. Read S2 read-only; never open any `.env*` file. The repo gets only findings: structures, kinds, ID patterns and counts, never requirement text, business rules, or client or partner names.

## What to do
1. Rework the trial for the new format: S2's patterns and their rules as `pattern` and `pattern_rule` records with the slice's domain following them; S2's flow step tables as `flow_step` records with their own `fulfills`; S2's pattern proofs via `key`; remove extension rows the defaults now cover; and move S2's house rules (for example one Record view use case per aggregate, level matching) into the trial's own `checks` folder.
2. Run the check and compare coverage per obligation kind (now including pattern rules) and per flow step with S2's traceability for the slice.
3. Add a section 7, "Pass 6 re-run", to `notes/trials/s2-accounting.md`: what is now done of section 6.6's list and of findings A–H; the check result and coverage table; anything new that broke or is awkward; and an updated, prioritized list of what to change next.

## Scope
You own `notes/trials/**` in the repo and your new scratch folder. Use unique names for any scratch scripts.

## Checks
The trial's `lathe check` result, and `git status` showing nothing changed outside `notes/trials/`.
