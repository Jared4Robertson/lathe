# Brief: a Nested view of the graph (children inside parents)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main` (the graph is one fixed map, `app/src/graph/map.ts` and `camera.ts`). Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner wants a second way to see the graph: "the children are 'inside' the parents, or the parents are made up of the children, rather than linked". The product is made of domains, and you zoom in to see each one. A domain is made of Define and Design, and they're made of folders, aggregates and so on. Today's view (the icicle, parents beside their children) stays as the Tree view.

## Decisions (recommended; apply them)
1. **A switch, Tree or Nested,** in the graph's toolbar. It's saved with the tab's graph settings, has a keyboard command and shortcut, and appears in the command list. Tree stays the default.
2. **Nested is a zoomable treemap of rectangles** over the same tree as the Tree view: the product (single root, per brief 82), domains, stages, folders, records and their children.
   - A box is sized by the number of leaf records under it.
   - Children are laid out inside the box, squarified, in tree order where possible.
   - Each box has a header band with its label; its children sit below it.
   - The layout is built once per spec load, like the Tree map, and never changes with focus.
3. **Focus is the camera,** with the same rules as the Tree view:
   - selecting a box (click, address, Back and Forward, trail, step keys) glides the camera to frame it;
   - depth (1–3) is how many nesting levels inside the focus are drawn with labels;
   - deeper boxes are plain shapes until you zoom;
   - free zoom and pan work as before.
4. **Text is proportional to its box.** Set once when the map is built, never changed by focus or zoom (brief 80's rule). Below about 7 px on screen, the label is hidden.
5. **Shapes:** boxes are rectangles. A domain keeps a small hexagon mark in its header, and other kinds keep their marks the same way. The key lists every mark (LA-PAT-APP-CODE-R21).
6. **Links:** the Links switch draws cross-links as curves between drawn boxes, with edge hints for those off screen.
7. **Shared with the Tree view:** the side bar (Details, Outline), hover, the trail, the minimap (an overview of the Nested map) and addresses (the view goes in the tab settings, not the address).
8. **Structure the code so the views share as much as possible:** one camera and one level-of-detail and label module, with two layout functions (`map.ts` for Tree, and a new `nested.ts`).

## Specs
In Exploring: a requirement under the graph use case (mind the 15-children limit), rules for the Nested layout and its camera, and tests, continuing from the highest IDs in each kind. Add the command to Platform's command use case if that's where commands live.

## Scope
- **Running at the same time:**
  - brief 80 (graph text and chevron, `app/src/graph/**`): merge after it, adopt its label module and keep its rules;
  - brief 82 (products as separate spaces: one map per product);
  - brief 81 (leftover checks).
- Merge main before reporting, and keep both sides.

## Checks
- The full checks from the common rules, plus the stability, a11y and perf suites, once each with one worker. Nested re-centering must meet the depth-3 budgets.
- In a browser, switch views on a product, a domain, a stage and a record at depths 1–3.
- Save screenshots to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/nested/`.
- Never use port 5199.

## Report
The branch and its last commit, the screenshots, files changed, decisions made, the checks you ran and their results with perf numbers, and anything left open.
