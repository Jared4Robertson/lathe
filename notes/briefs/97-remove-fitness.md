# Brief: remove fitness

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner decided to remove the concept of fitness entirely: the `fitness` record kind (a dated 1–5 score judged by the person a product serves) and Lathe's own plan to judge itself that way. This is a hard cutover that leaves no trace.

## Remove
- **Meta-model:** the `fitness` row in `lathe/meta/kinds.csv` and `ids.csv`, and any relations or sections rows for it.
- **Checks:** `lathe/checks/24-bad-fitness-date.sql` and `25-bad-fitness-score.sql`, their tests and fixtures (`lathe/test/fixtures/fitness/`), and their entries in REFERENCE.md. Don't renumber the other checks.
- **Engine:** any fitness code, plus the FORMAT.md section and every mention in FORMAT.md and REFERENCE.md. Renumber the FORMAT sections after it and fix the links to them.
- **App:**
  - the fitness score, history and "Evidence" panel on the product page (`ProductHealth.tsx` and its callers);
  - fitness entries in `plural.ts`, `shapes.ts`, `model.ts`, `tree.ts`, `panel.tsx`, `FormatPages.tsx`, `Markdown.tsx`, `SpecPages.tsx` and `styles.css`;
  - their tests and fixtures.
  
  If the product page still shows coverage, open questions and checks, keep them as plain product facts, without the "evidence beside the judgment" framing.
- **Specs:**
  - Lathe's product paragraph "How Lathe will judge whether it is improving".
  - The open question LA-Q01 (`specs/lathe/questions/Q01-how-the-owner-judges-lathe.md`). If the Open questions group is left empty, remove whatever then serves nothing.
  - Event EV02 "Fitness recorded".
  - Checking UC01-R06 and T09.
  - Traceability UC09-R04 and T85.
  - Component C36: rename or reshape it if it still covers coverage.
  - V01 product-page wording.
  - The format and graph records that list fitness among the kinds (DR65, DR45, UC02-R05, UC05-R12, C50, UC03, T110, C62, V01 in Authoring, DR01 in Checking, UC11-R07).
  
  Remove a record only when its whole purpose was fitness; otherwise drop the mention.
- **Notes:** the LA-Q01 row in NOTES.md. Leave historical briefs as they are.
- **Fonts:** the font licence files (`OFL.txt`) match "fitness" only as ordinary licence wording. Leave them alone.

## Checks
- Sweep afterwards: `grep -ri fitness` outside node_modules, dist, `.git`, `notes/briefs` and the font licences must find nothing.
- Then run the full checks (typecheck, unit tests, knip in app, lathe and desktop; `npm --prefix lathe run check` with no new warnings), plus the stability and a11y suites, each once with one worker, gated on real exit codes.
- Look at a screenshot of LA's product page, saved to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/fitness/`.
- Never use port 5199.

## Report
The branch and its last commit, what was removed and what was reworded, the sweep result, and the checks run with their results. Leave nothing open.
