# Brief: one text rule for every layout — size by depth

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The graph's text rules grew special cases:
- Tree sizes text by depth from its level widths;
- Nested by height from the leaves (so Shared and the domains differ);
- Voronoi per cell.

The owner asked for a simplified rule and chose this one:

**A box's text size depends only on its depth.** Every box at the same depth from the product has the same text size, each depth a fixed step smaller than the one above, and boxes are sized to fit their labels. The same rule holds in Tree, Nested and Voronoi.

## Decisions
1. **`DEPTH_TEXT_STEP` = 0.6.** The deepest level in the product's tree has scale 1, and each depth above is 1 / 0.6 times the one below it, so the product has the largest. Set once at map build, never changed by focus or zoom. Depth counts from the product: the product is 0, then domains and Shared, then stages, and so on.
2. **Boxes fit their labels at their depth's scale,** with titles wrapped on whole words, in every layout:
   - **Tree:** a level's width follows its text scale (leaf width × scale). Leaves grow taller to fit, and parents are as tall as their children stacked, as now. The old width-based scale goes.
   - **Nested:** the bottom-up minimums use the depth scale, and the height-level code goes.
   - **Voronoi:** each cell's weight is the larger of its record share and the area its label needs at its depth's scale, with the fit passes as before. Per-cell text sizing goes.
3. **Hard cutover:** delete the height-level and per-cell code, their constants, tests and spec wording. One shared helper in `text.ts` gives a box's scale from its depth, and all three layouts use it.
4. **Tuning without exceptions.** If a test bar fails (for example the 16 px record label on a framed use case, or Voronoi proportionality), you may change `DEPTH_TEXT_STEP` within 0.5–0.75 for all layouts at once. Never add a per-layout or per-kind exception. If no step passes every bar, report the numbers; don't add a special case.
5. **Bars:**
   - every drawn box shows its whole label (R12);
   - at depth 2 on LA-EXP, in each layout, the framed domain and stage headers read at a glance;
   - the stability suite's existing label checks pass unrelaxed;
   - Voronoi stays at 90% or more within 5% of record share (report the number).
6. **Sweep:** the R12 sweep checks one text size per depth in all three layouts, the same check for each.

## Specs
In Exploring:
- rewrite DR58, DR60, DR62 and DR64 and the text tests to state the one rule;
- remove the Voronoi exception and the height-level wording;
- update R12's tests.

## Checks
The full checks, plus the stability, a11y and perf suites, once each with one worker. Gate on real exit codes. Save screenshots of LA and LA-EXP in all three layouts to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/depth/`, and look at them: Shared and the domains must have matching text. Never use port 5199.

## Report
The branch and its last commit, the step used, map sizes, Voronoi's proportionality, the screenshots, the checks you ran and their results, and what was removed.
