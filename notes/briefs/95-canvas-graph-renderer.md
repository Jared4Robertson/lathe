# Brief: draw the graph on a canvas

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. This is a trial branch: the owner merges it if they like the result and abandons it otherwise, so commit fully to the new approach.

## Goal
The graph's vision:
- one fixed map, explored by camera;
- text in proportion to its box;
- every label rendered;
- in Tree, Nested and Voronoi alike.

Today each box is an HTML element under React Flow, and pan and zoom are one CSS transform (`app/src/graph/GraphPage.tsx`, `camera.ts`). Big maps make text tens of thousands of pixels in map units (about 22,000 px for the product's title on LA's Nested map), and the browser draws that text blurry or with a size floor. Rounds of layout workarounds have followed: text-scale caps, camera floors, a hand-kept character width table.

The renderer should serve the vision, so draw the map on a canvas instead. Each frame, each visible box's text is drawn at its on-screen size (map size × zoom), so text is crisp at any zoom whatever the map's range.

## Decisions
1. **Canvas 2D,** one `<canvas>` per graph pane, sized with `devicePixelRatio`. Move to WebGL (PixiJS) only if Canvas 2D misses the perf budgets on LA; report the numbers if it does.
2. **Keep the layout code:** `map.ts`, `nested.ts`, `voronoi.ts`, `tree.ts`, `shapes.ts`, `camera.ts` (its math). Only the drawing layer changes. React Flow leaves the graph (hard cutover), but stays in `app/src/model/ModelView.tsx`, which is out of scope.
3. **Drawing each frame:**
   - Cull offscreen boxes.
   - Every visible box draws its shape, border and fill, and its label lines at map size × zoom.
   - A label under about 1 on-screen pixel can be drawn as a faint bar in place of glyphs, which still counts as rendered (R12).
   - Edges, links mode, problem badges, marks and shape icons, the focus ring, hover, and the selection all follow the current look and the stylesheet's colors in light and dark (read the CSS variables).
4. **Real text measurement:** wrap titles with `ctx.measureText` on the loaded fonts (await `document.fonts.ready` before layout), in place of the width table in `text.ts`. Layout stays once per spec load and deterministic for a given font. Remove the width table and `WIDTH_MARGIN` once nothing needs them, and keep a plain fallback measure for unit tests in Node.
5. **The camera:**
   - Animated focus moves stay as today: a click frames a box, and the trail, arrows and Depth work as before.
   - Wheel and pinch zoom about the pointer, and drag pans, all drawn with `requestAnimationFrame`.
   - With crisp text at any zoom, remove the Tree camera floor and any zoom clamp that existed only for text. Keep sensible overall zoom limits.
6. **Hit testing:** find the box under the pointer from the layout's rectangles (or Voronoi polygons) in map space. Use the deepest box under the pointer, or a spatial index if needed for speed.
7. **Accessibility layer:**
   - A visually hidden DOM tree of the drawn boxes, in the tree's order, carries focus, keyboard moves (the arrows, Enter, Escape as today), roles and names. The focused box gets the drawn focus ring.
   - Screen readers and the a11y suite use this layer. Keep the existing keyboard behavior and accessible names.
8. **The minimap** draws on its own small canvas or stays SVG; either is fine.
9. **Text rule unchanged:** keep main's text rules for each layout as they are, including brief 94's top-level rule if it is merged first; merge main before reporting. Report how framed parents read now. Don't change the rules in this brief.
10. **Tests:**
    - Stability and a11y tests that read node DOM move to the accessibility layer, or to a test hook exposing the drawn scene (each box's on-screen rect and label lines and font size), plus screenshots.
    - The R12 sweep checks the scene: every drawn box has its whole label inside it.
    - Keep every existing assertion's intent; never relax a bar to pass.
    - Unit-test hit testing, culling and text sizing.
11. **Specs (Exploring):**
    - Update DR59 and DR60 and the relevant components and tests to say the map is drawn on a canvas each frame, with text at map size × zoom and a hidden DOM layer for access.
    - Remove the wording about the width table and React Flow.

## Out of scope
The Model view, the layout rules, the side bar and the wiki.

## Checks
- The full checks (typecheck, unit tests, knip in app, lathe and desktop; `npm --prefix lathe run check`), plus the stability, a11y and perf suites, each run once with one worker, gated on real exit codes.
- Perf: the depth-3 re-center budgets hold (longest frame under 100 ms, under 500 ms of work, at most 3 frames over 20 ms). Report the frame times for zoom and pan on LA in each layout.
- Save screenshots to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/canvas/`:
  - LA and LA-EXP in all three layouts, framed and zoomed in two steps;
  - before-and-after pairs from main at the same views;
  - light and dark.
  
  Look at them: text sharp at every zoom, and every box labeled.
- Never use port 5199, which is the owner's dev server. `.claude/launch.json` points at it, so start your own server on another port and stop it by its PID. Close the browsers.

## Report
The branch and its last commit, whether Canvas 2D held the budgets, frame times, the screenshots (before and after), how framed parents read now, the checks run with their results, what was removed, and anything left open.
