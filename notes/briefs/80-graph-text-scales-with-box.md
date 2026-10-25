# Brief: graph text scales with its box

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main` (the graph is one fixed map since brief 79, `app/src/graph/map.ts` and `camera.ts`). Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner wants the graph to feel like zooming into one picture. Today a box's text is held at about 0.9 of a leaf's size on screen, and wraps in narrow boxes ("Capabi lities"). Their words: "why not just make the text smaller?"

Text is part of the map. A box's text scales with the box, and only the camera changes how big anything looks.

## Decisions
1. **One scale per box.**
   - A box's title, kind and ID line, chevron and padding scale together, so that its longest line fits the box's width and its text fits its height.
   - A title never wraps mid-word.
   - If the full title at that scale won't fit on one line, truncate it with an ellipsis, so the kind and ID still read.
   - Hexagon domains keep their outline scale (`--box-scale`) separate from the text scale.
2. **Only the camera changes on-screen size.** Zooming in grows the text with its box. Focusing changes nothing else.
3. **Readability cutoff:** below about 7 px of on-screen text, draw no label, only the shape. Recompute this when the camera settles and while zooming. Don't measure the DOM every frame; use the box size and the estimated text width.
4. **The width ratio stays at 3×** between levels.

## Specs
In Exploring (`LA-EXP`):
- Update `DR58` and `DR60` to state the rule above.
- Update `T176` (unit).
- Update `T177` (stability). At depth 2 on Exploring, every framed box whose label would be at least 7 px on screen shows its full title, or a truncated one with its ID, on one line.

## Scope
You own `app/src/graph/**`, the graph CSS, and the graph tests and scenarios.

## Checks
Run the full checks from the common rules, plus the stability and perf suites once each, with one worker. Re-shoot the screenshots of LA-EXP and LA-EXP/define at depths 1–3 into `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/map/text-*.png`. Never use port 5199.

## Report
The branch and its last commit, the screenshots, the checks you ran and their results with perf numbers, and anything left open.
