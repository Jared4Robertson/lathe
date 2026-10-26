# Brief: one text size per level in Nested and Voronoi

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner: "can we make the text of each level the same size now that we are smarter with the way we size things?" Tree already has one text scale per level. In Nested and Voronoi, each box's text is as large as its label fits, so siblings at one level differ. Now that layouts are sized from the leaves up, flip it: fix one text scale per nesting level, then size every box to hold its label at that scale.

## Decisions (recommended; apply them, hard cutover)
1. **Text scale by level,** in Nested and Voronoi:
   - a leaf, the deepest level, is 1;
   - each level up is `NESTED_LEVEL_STEP` = 1.5 times the level below, by tree depth from the deepest leaf under the product;
   - every box at one nesting level has the same scale;
   - set once at map build, never changed by focus or zoom.
2. **Nested:** the bottom-up minimums use the level's fixed scale. A leaf's minimum is its label wrapped toward about 3:2 at its level's scale. A parent's minimum is its header at its level's scale plus its children packed. Then top-down: each child gets the larger of its record share and its minimum. Every label fits by construction. Remove the per-box "largest scale that fits" code.
3. **Voronoi:** each cell's weight is the larger of its record share and the area its label needs at its level's scale, in its cell's typical shape. Report how many cells stay within 5% of their record share, against 99.7% today. If a label still can't fit after the iterations, grow that cell's weight and iterate again, up to a bounded number of passes. No label may shrink below its level's scale.
4. **Tree is unchanged,** with its width-based scale per level and the 3× step.
5. **R12 sweep:** add a check that in every layout, all boxes at one level share one text scale, and every drawn box's label fits at it.

## Specs
In Exploring, rewrite the Nested and Voronoi text rules (DR62–DR64 and those near them) and their tests to say one scale per level. Run the removal sweep for the per-box scale's names.

## Checks
- The full checks, plus the stability, a11y and perf suites, once each with one worker. Gate on real exit codes; never pipe a gate.
- Save screenshots of Nested and Voronoi on LA and LA-EXP to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/levels/`.
- Never use port 5199.

## Report
The branch and its last commit, the screenshots, Voronoi's proportionality before and after, map sizes before and after, the checks you ran and their results, and anything left open.
