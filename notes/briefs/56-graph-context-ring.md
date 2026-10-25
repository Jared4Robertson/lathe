# Brief: the graph shows the next ring out, faded and out of focus

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 53 phase 1 (jitter) has merged, since it works in `app/src/graph/**`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Depth 1 shows only the focus, its parent (or folder) and its children (or their folders). The rule is `LA-BRW-UC20-R01`, and `neighborhood` in `app/src/graph/model.ts` implements it. Jared: "maybe we show them but fade them and cut them off in terms of focus instead?" He wants a sense of where the record sits without the noise.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **A context ring.** At every depth, the graph also draws the next ring out, as **context**:
   - At depth 1 that is the tree's next level: the parent's parent (or its folder) and the children's children (or their folders, folded). Hierarchy only, as depth 1 is.
   - At depth 2 and 3 it is the records one more hop away, by the same walk that depth 3 or 4 would take, with the same filters.
   - Model: `Neighborhood` nodes and edges gain `context: true` for the ring. Compute it once and deterministically, so it never jitters (R17).
2. **How context looks:**
   - Context nodes are drawn faded (about 35% opacity) and slightly smaller (scale about 0.9 around their center).
   - Their marks (errors, gaps) are faded too, and their labels stay readable on hover.
   - Edges to or between context nodes are faded and thinner.
   - Use tokens: a new `--context-opacity`, and the motion tokens for the fade (R12).
3. **Context is out of focus:**
   - Context nodes are not in the canvas's keyboard order: the arrow keys and Tab skip them.
   - They carry `aria-hidden="true"` and are left out of the canvas's accessible list.
   - The summary counts focus records only ("9 records · 6 more faded").
   - The inspector's "Connected in the graph" lists focus records only.
   - A pointer click on a context node still re-centers on it: it fades in as the camera moves (brief 46), and the ring around the new focus rebuilds.
   - Hover shows the node's name and ID in a tooltip.
4. **Cut off at the frame:**
   - The camera frames the focus nodes only, using their bounding box, so the context ring may run past the canvas's edges.
   - A soft vignette of the panel background at the canvas edges, CSS only and theme-aware, makes the cut-off read as intended.
   - Fit (the `.` command) also fits the focus nodes only.
5. **Filters:** add a "Show context ring" switch under Filters, on by default and remembered with the other graph settings, per tab (brief 41). Off gives today's picture.
6. **Reduced motion:** context nodes simply appear, dimmed, with no fade.

## Records
- Update `LA-BRW-UC20-R01` (what each depth shows: the context ring) and `UC40-R03` (a group at the center, also with its ring).
- Add domain rules from `LA-BRW-DR300`, components from `LA-BRW-C290`, and tests from `LA-BRW-T540`. The tests cover:
  - the model's ring at each depth, for a record and for a group;
  - context left out of keyboard order and the summary;
  - framing from the focus nodes only;
  - the filter switch.
- Update the tests that assert exact node sets at depth 1 (T277, T102 and others), so they assert focus nodes and context nodes separately.

## Scope
- **You own:** `app/src/graph/**`, the graph styles in `styles.css`, the graph tests, and the records above.
- Check which agents are running when you start, and stay out of their files.
- Never use port 5199. Use `npx vite --port 5417` in `app/` and stop it. Run brief 53's stability suite before reporting: re-centers must stay within the R17 budget.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and what you saw in the browser at depth 1, 2 and 3.
