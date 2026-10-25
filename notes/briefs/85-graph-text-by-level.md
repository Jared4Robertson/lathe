# Brief: graph text sized by level, titles wrap on whole words

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main` (brief 80 merged: text fixed to its box, `app/src/graph/text.ts`). Work in your own worktree, and finish with your branch ready to merge.

## Goal
Brief 80 sized each box's text by its height over a leaf's. Parents are as tall as all their leaves, so upper titles became hundreds of times a leaf's size. Keeping every title on one line then made the levels enormously wide (the map was about 574,000 × 166,000 units), and at depth 2–3 most deeper boxes can't be labeled. The owner decided:

"size text by the level (width), wrap long titles on whole words, and let a leaf grow taller to fit its title."

## Decisions
1. **Text scale per level.** Every box in a level has one text scale: the level's width over a leaf level's width. Levels keep the 3× width rule (at most 3× the level below; the product level at most 1.5× its domains), so a parent's text is up to 3× its child's. The scale is set when the map is built and never changes on focus or zoom (brief 80's rule stands).
2. **Level widths are proportional again.** Remove the title-driven widths from brief 80. Titles no longer set widths; they wrap instead.
3. **Titles wrap on whole words.** Never mid-word, no ellipsis, and nothing is clipped. A single word longer than the box's width is the only exception: it may break, but test that no title in Lathe's own spec or the Tool Library needs to. The kind and ID line may wrap too.
4. **Leaves grow to fit.** A leaf's height is the larger of the base leaf height and what its wrapped label needs at its level's text scale, plus padding. Parents stay exactly as tall as their children stacked, gaps included, so the map still lays out once and nothing moves on focus.
5. **Labels on parents** are centered in the box. A tall parent's label never needs more room than its box has, since its text scale comes from its width.
6. **Keep:**
   - the 7 px on-screen cutoff, which only hides or shows a label;
   - the problem badge rule.
   
   Keep the camera floor from brief 80 (never zoom out past the focused box's own title being readable) only if it's still needed; say which.
7. **Estimate, don't measure per frame.** Wrapping uses brief 80's character-width table in `text.ts`, at map build time.

## Specs
In Exploring, rewrite `DR58` and `DR60` (and `DR59` if the camera floor changes), and the tests `T176`, `T182`, `T183` and `T184` to match. Add a test that every title in Lathe's spec and the Tool Library wraps without breaking a word.

## Scope
- **Running at the same time:** brief 83 (the Nested view) is building against brief 80's label module. Keep `text.ts`'s exported functions where you can, and change their behavior, not their names.
- Merge main before reporting, and keep both sides.

## Checks
- The full checks from the common rules, plus the stability, a11y and perf suites, once each with one worker.
- Report the level widths and the map size for Lathe's spec, and how many boxes are labeled at depth 2 on LA-EXP, against brief 80's 19.
- Save screenshots to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/map/level-*.png` at depths 1–3 on LA-EXP and LA-EXP/define.
- Never use port 5199.

## Report
The branch and its last commit, the numbers and screenshots, the checks you ran and their results, and anything left open.
