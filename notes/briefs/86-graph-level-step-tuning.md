# Brief: tune the graph's level step so framed levels are readable

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main` (brief 85 merged: text per level, whole-word wrapping). Work in your own worktree, and finish with your branch ready to merge.

## Problem
Each level is at most `MAX_LEVEL_STEP` (3) times as wide as the level below, and its text scales the same way. So framing a domain at depth 2 makes its stages a ninth of its text size and its folders a twenty-seventh, under the 7 px cutoff. At depth 2 on LA-EXP only 4 boxes are labeled (counts.txt from brief 85). Proportional sizing must stay; the step is the lever.

## What to do
1. **Measure.** Write a measuring script or test. For `MAX_LEVEL_STEP` 1.25, 1.5, 2 and 3 (with `MAX_ROOT_STEP` scaled to match), compute, in a 770 × 640 graph pane and a 1200 × 800 one:
   - how many framed boxes are labeled at depths 1, 2 and 3;
   - for LA-EXP, LA-EXP/define and LA-EXP-UC03;
   - the map's size.
   
   Use the real camera framing and the 7 px rule. Put the table in your report.
2. **Pick a step:** the largest step at which, at depth 2 in the 770 px pane, every framed level shows labels on the focus and its children, and the grandchildren level shows labels on at least half its framed boxes. Parents must still read clearly bigger than children (at least 1.25×). Set it, and make depth 3 the "overview" depth whose deepest level may be plain.
3. **Leaf width:** if no step meets the rule, raise `NODE_WIDTH` too, so fewer titles wrap and leaves stay short. Report the leaf width you chose.
4. **Restore T177's threshold** to a real count: at depth 2 on LA-EXP, at least the focus, its stages and half the folders read. Update DR57–DR60 if the numbers in them change.

## Checks
The full checks, plus the stability and perf suites once each, with one worker. Save screenshots at depths 1–3 on LA-EXP to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/map/step-*.png`. Never use port 5199.

## Report
The measurement table, the step and leaf width chosen and why, the screenshots, and the checks you ran with their results.
