# Brief: equal siblings, laid out top-down

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner's graph requirements are:
- one fixed map, explored by camera;
- text in proportion to its box;
- every whole label rendered;
- siblings with the same text;
- a focused box's header readable;
- one simple rule in Tree, Nested and Voronoi.

Every bottom-up rule so far has broken one of these. The owner chose this rule:

**Siblings are the same size, with the same text.** Each parent splits its space equally among its children, top-down from one fixed product box. A busy sibling packs its children smaller; a quiet one has blank space. Because the graph is moving to a canvas (brief 95, running alongside), small text is fine: you zoom in.

## Decisions
1. **Top-down from a fixed root.** The product's box has a fixed size, and each box's children get equal shares of its inner room. Record counts no longer size anything.
2. **Text follows the box, shared by siblings.**
   - A box's header text is a fixed fraction of its box's size, the same fraction at every depth.
   - Siblings share one text size: the largest at which every sibling's whole label (kind and ID line, and title wrapped on whole words) fits its header band.
   - A framed box's header therefore reads at about the same on-screen size whichever box is framed.
3. **Per layout:**
   - **Nested:** each parent's room under its header holds its children as a grid of equal squares in the tree's order, with the column count picked to make the squares largest. Leftover room is blank.
   - **Tree** (icicle): siblings split their parent's height equally, and every box in a depth column has the same width, the column widths fixed fractions of the map. Text follows the box as in decision 2.
   - **Voronoi:** each parent's cell splits into equal-area cells for its children, and siblings share text sized to fit the smallest sibling cell's label room.
4. **Hard cutover:** remove the bottom-up sizing and everything only it used, along with their tests and spec wording:
   - leaves-first least sizes, `leafSide`, least-square packing;
   - height and depth text levels, `settleLevelScale`;
   - brief 94's shared top-level scale, which the new rule covers;
   - record-share weights and fit passes in Voronoi;
   - the Tree's text-driven level widths.
5. **Precision.** Deep boxes get very small against the root. Keep map units in doubles, and give the renderer coordinates relative to the camera center, so deep zoom doesn't jitter. Camera zoom limits must allow framing the deepest leaf.
6. **Specs (Exploring):** rewrite DR58, DR60, DR62 and DR64 (and the Voronoi DR) to state the one rule, and update or replace the text and layout tests. R12 stays: every drawn box shows its whole label.

## Coordination
Brief 95, on its own branch, replaces the renderer (React Flow to canvas) and `text.ts`'s measurement (`ctx.measureText` in place of the width table).
- You own the layout files: `map.ts`, `nested.ts`, `voronoi.ts`, `voronoi.worker.ts`, `tree.ts`, and the layout parts of `text.ts`, with their unit tests and specs.
- Don't touch the rendering in `GraphPage.tsx` or the measuring functions, beyond calling them.
- Whichever branch merges second merges main and resolves the conflicts, keeping both sides: the canvas renderer with this layout.

## Checks
- The full checks, plus the stability, a11y and perf suites, each run once with one worker, gated on real exit codes.
- Unit tests:
  - siblings have equal boxes and equal text in each layout;
  - every label fits its box;
  - a framed box's header has the same on-screen size at every depth.
- Save screenshots of LA and LA-EXP in all three layouts, at the product and framed on a domain, a stage and a folder, to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/equal/`. Look at them: siblings match, framed headers read, and every box is labeled.
- Never use port 5199. Start your own server on another port and stop it by its PID.

## Report
The branch and its last commit, the fractions chosen, framed-header on-screen sizes at each depth, the screenshots, the checks run with their results, and what was removed. Leave nothing open.
