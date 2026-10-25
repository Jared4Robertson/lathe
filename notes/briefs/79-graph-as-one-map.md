# Brief: the graph as one fixed map, explored by camera

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main` (with brief 72's icicle). Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner: "when I focus a child in the graph, it shouldn't grow to the same size as its parent. All sizes should remain proportional so it just feels like I'm exploring a diagram without anything changing sizes. Just really zooming in and out and centering."

Today the icicle is laid out again around each focus, so a node's size depends on what is in focus. Instead, lay out the whole tree once as one fixed map. Focusing anything is a camera move: pan and zoom. Nothing is re-laid out, and nothing changes size.

## Decisions (recommended; apply them)
1. **One map per spec load:** an icicle over the whole tree, the same tree as the nav: product, domains, stages, folders, records, then their children. A node's size comes from its subtree alone, never from the focus. A leaf has a fixed size. A parent is exactly as tall as its children stacked, gaps included.
2. **Widths:** one width per tree level, so every node in a level has the same width. Widths shrink toward the leaves in proportion to the level's typical height, capped so the product level stays usable. Content (text, kind, ID, chevron) scales with its node, centered, and is limited by the smaller of the node's width and height ratios, as in brief 72.
3. **Focus is the camera:**
   - Selecting a node, from a click, the address, Back and Forward, the step keys or the trail, glides the camera so the focused node and the levels shown below it fill the pane.
   - The parent level stays visible at the left edge for context.
   - The glide is one smooth zoom and pan (`--motion-*` tokens, reduced motion respected).
4. **Depth** is how many levels below the focus the camera frames: 1, 2 or 3.
5. **Level of detail:** draw only what's in view and big enough to read.
   - A node too small on screen for text draws as a plain filled box, and smaller still not at all, or as one bar standing for its children.
   - Labels appear as you zoom in.
   - Keep the drawn node count bounded, so a product of thousands of records stays within the performance budgets.
6. **Free zoom and pan** (wheel, pinch, drag) move the same camera. The fit button frames the focus again.
7. **Links switch:** cross-links draw as curves between drawn nodes. A link to a node that's off screen shows an edge hint pointing that way.
8. **Removed (hard cutover):**
   - the per-focus layout and its glide of sizes;
   - the context ring, since the whole map is the context;
   - the "+N more" chips, since every child exists in the map.
   
   Delete their code, tests and spec records, or edit the records that describe them.
9. **Kept:** the side bar's Details and Outline, hover, the trail, the minimap (now a true overview of the one map), the Model view (untouched), and the addresses.

## Scope
- **You own:** `app/src/graph/**`, the graph CSS, graph tests, and the graph stability and perf scenarios.
- **Running at the same time:** brief 76 (converting `specs/lathe/**` to slices, which renames record IDs everywhere), 77 (removing CSV diagrams) and 78 (`involves` on domain rules). Put your spec records in the current `LA-BRW` domain with IDs from T740, DR390 and C400 upward; 76 converts them. Merge main before reporting.

## Checks
- The full checks from the common rules, plus stability, a11y and perf, once each, with one worker. Re-centering is now a camera glide, so it should be well inside the depth-3 budgets.
- Look at it in a browser:
  - focus a domain, then a stage, a folder and a record, and confirm with screen measurements that no node's map size changes;
  - Back and Forward;
  - depths 1–3, Links on and off.
- Save before and after screenshots, and a short sequence of a child focus, to the scratchpad.
- Never use port 5199.

## Report
The branch and its last commit, the screenshots, files changed, what was removed, decisions made, the checks you ran and their results with perf numbers, and anything left open.
