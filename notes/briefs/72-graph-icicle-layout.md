# Brief: the graph's tree as an icicle (parents as tall as their children)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Today a node with many children sits at its own height in the middle of its column, and lines fan out from it to every child. The owner asked for each parent to be as tall as its children combined, so the tree reads like an icicle (a horizontal partition chart): every child sits right beside its parent, its connector is short and straight, and there is no fan.

## Today
- `app/src/graph/layout.ts`: `layeredGraph` and `layoutNeighborhood` lay the neighborhood out with ELK `layered` (direction RIGHT, columns as partitions, model order kept), in the worker (`app/src/elk.ts`). Every node is `NODE_WIDTH` × `NODE_HEIGHT`.
- `app/src/graph/tree.ts` holds the tree (the nav's tree, with stage and folder groups as levels); `model.ts` builds the neighborhood (depth as levels, the Links switch, the context ring, "+N more" chips).
- `motion.ts` and `camera.ts` animate boxes and frame the focus; `hints.tsx` draws the edge hints.

## Decisions already made (recommended; apply them)
1. **Heights:** a node with children shown in the next column is exactly as tall as those children stacked, gaps included. A leaf, and a node whose children aren't shown, keeps today's height. A "+N more" chip counts as one child slot.
2. **Placement:** children stack in tree order, and their stack starts at the parent's top edge, so each parent spans its children exactly. Columns stay where they are, a level apart.
3. **Ancestors:** the levels above the center span what they show. At depth 1 the parent spans only the center, so it is as tall as the center.
4. **Tree connectors** become short horizontal lines from the parent's right edge to each child, at the child's middle. Keep them, since they still say "parent of", and keep the relation labels.
5. **Unchanged:** cross-links (the Links switch) and context-ring links keep today's curved edges, drawn over the icicle. The context ring stays faded and out of focus.
6. **Tall nodes:** a tall node's title, kind, ID and chevron stay at its top, and stay readable while the node is in view. A node isn't stretched past what its children need.
7. **Layout engine:** compute the tree part directly; the icicle is deterministic, and that's faster than ELK. Keep ELK, in the worker, only where it still earns its place, for example placing context-ring nodes. Say what you chose.
8. **Motion:** re-centering animates heights as well as positions, within the depth-3 budgets Jared confirmed (longest frame under 100 ms, under 500 ms of work, at most 3 frames over 20 ms). Nothing outside the canvas moves (LA-PAT-APP-UX-R08).
9. **Unchanged views:** the Model view (ERD) and the diagrams.

## Scope
- **You own:** `app/src/graph/**`, the graph rules in `app/src/styles.css`, and graph tests and stability scenarios.
- **Specs:**
  - add a requirement under UC40 or UC20 (mind the 15-children warning), a domain rule under the Graph picture aggregate (A12), and tests;
  - update C-records that describe the layout.
  
  Use IDs from T640, DR330 and C340 upward.

## Checks
Run the full checks from the common rules, plus `npm --prefix app run test:stability` (one worker) and `npm --prefix app run test:perf`. Look at the graph in a browser at depths 1, 2 and 3, with Links on and off, on a product, a domain, a stage group and a record. Never use port 5199.

## Report
- the branch and its last commit;
- before and after screenshots, in the scratchpad, and say where;
- files changed;
- each decision you made, and why;
- the checks you ran and their results, including perf numbers at depth 3;
- anything left open.
