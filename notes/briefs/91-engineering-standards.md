# Brief: engineering standards

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. Source: notes/trials/s2-trial-4.md, section 4.9 (findings only; never copy client text).

## Decisions (made by the coordinator on the owner's standing instruction; apply them)
1. **`standard`** (product level, like `pattern`): a library of engineering rules that holds for the product's code, such as logging, error handling or naming. **`standard_rule`** sits under a standard, with its own ID.
2. **`meets`**: from a component, design step or test to a `standard_rule`. Its labels are "Meets" and "Met by", and it has no role.
   - Standards owe no coverage; a standard rule is not an obligation.
   - The checks: a cited standard rule must exist (`dangling-link` already covers links), and a prose citation of a standard rule's ID is a mention like any other.
   - New check `standard-rule-unmet` (warning): a standard rule that nothing meets or cites, in the spirit of "nothing outlives its purpose".
3. **Stay as patterns:** Lathe's App code and App experience patterns, because their rules are proved by tests, and proof is what a pattern gives that a standard doesn't. Record this in FORMAT.md as the rule of thumb: a rule you prove with tests is a pattern rule; a rule you follow and cite is a standard rule.
4. **The app:**
   - standards appear under Shared in the nav, beside patterns;
   - a standard's page lists its rules with what meets each one;
   - a rule's Traceability shows "Met by";
   - a format reference page comes from the meta-model.
   - Graph and key entries use a plain box (brief 88 adds shapes).
5. **Dogfood:** write one small standard for Lathe from what the code already does consistently, for example "Engine and app code" with rules such as checks are single SELECT statements with the standard header, and git runs from argument arrays only. Link a few components that meet them. Keep it honest: only rules the code really follows.

## Scope
`lathe/meta` (kinds, relations and sections), the checks, the app's nav, pages and side bar, FORMAT.md and REFERENCE.md, the plugin skills, and specs in Authoring. IDs continue from the highest per kind and slice. Briefs 89 and 90 run alongside and also touch the meta-model CSVs and FORMAT.md; merge main before reporting and keep both sides.

## Checks
The full checks, plus the stability and a11y suites, once each with one worker. Gate on real exit codes. Never use port 5199.

## Report
The branch and its last commit, what changed, the dogfood standard, the checks you ran and their results, and anything left open.
