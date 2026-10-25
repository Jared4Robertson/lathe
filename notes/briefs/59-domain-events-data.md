# Brief: domain events for the Tool Library and Lathe's domains

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. This brief is data only.

## Goal
Write the domain events each aggregate raises, and what reacts to them. Background: Lathe's own foundation, `NOTES.md` (Action and Occurrence), and `MODEL.md`.

The contract is committed (3aee302):
- `domain_event` sits under an aggregate, with a past-tense title and a `## Fields` table (Field, Meaning, Kind of value, Example);
- `raised_by` points at an entity of the same aggregate, and is optional;
- `reacts_to` goes from an aggregate, use case or component to the event;
- IDs are `<P>-<D>-EV<nn>`.

## What to do
1. **Tool Library (`TL-LEND`).** At least:
   - Member registered;
   - Tool added;
   - Loan opened;
   - Tool returned (or Loan closed);
   - Damage reported;
   - Tool repaired;
   - Loan overdue (raised when time passes; say so in its body).
   
   Each has fields, a `raised_by` its entity where it fits, and `reacts_to` links: for example, the Tool aggregate reacts to Loan opened (unavailable) and Tool returned (available, or needs repair). Use cases and components react where the spec already says so. Keep the examples on the same story as brief 44 (member 12, tool 7, loan 31).
2. **Lathe's domains.** Model events where they are real: for example spec changed and model changed (the live-reload events), check run, fitness recorded, view opened, theme chosen. Choose with judgment. Leave out what is UI noise, and list it in your report with the reason.
3. **Files:** `<domain>/01-define/aggregates/<aggregate folder>/events/EV<nn>-<slug>.md`, with `kind: domain_event`, `parent: <aggregate>`, a past-tense title, a one-sentence body before the Fields table, and `links` (`raised_by`).
   - `reacts_to` links go on the reacting record: the aggregate, use case or component.
   - You may add `links.reacts_to` to existing records. That's the only change to existing records you may make.
4. **Keep the structure checks quiet:** 15 or fewer events per aggregate.

## Checks
`npm --prefix lathe run check` must show 0 errors. The engine checks for events (brief 58) aren't in yet, so check past tense, `raised_by` staying inside its aggregate, and the Fields tables yourself with a small script, and report what it found. Run the full checks too.

## Scope
- **You own:** the new event records, and `reacts_to` additions on existing records.
- **Working at the same time:** brief 57a (`lathe/`), and briefs 52 and 53 (`app/`).

## Report
Use the format in 00-common-rules, with your branch and its last commit, and a table of events per aggregate with what reacts to each.
