# Brief: the graph shows the next ring out, faded and out of focus

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 53 phase 1 (jitter) has merged, since it works in `app/src/graph/**`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Depth 1 shows only the focus, its parent (or folder) and its children (or their folders). The rule is `LA-BRW-UC20-R01`, and `neighborhood` in `app/src/graph/model.ts` implements it. Jared: "maybe we show them but fade them and cut them off in terms of focus instead?" He wants a sense of where the record sits without the noise.

## First: the graph's tree is the nav's tree (Jared)
A domain's children in the graph are its stages, not kind groups: **Domain → Define and Design → their folders → records**. Use the one folder model the nav, domain page and group pages read (`app/src/specs/folders.ts`, from `Workspace.sections`):
- Define holds Domain model (aggregates, with their entities, events and rules beneath) and Capabilities (capabilities, then use cases outside any).
- Design holds Interaction design, Technical specification (layers, then components) and Test plan (the proof groups: acceptance by capability and use case, domain rule, pattern, interaction and engineering).
- Open questions and other kinds with no folder sit as the nav places them.
- The one-kind rule holds: a folder mixing kinds (Interaction design: flows, views, endpoints) splits by kind; a folder of one kind doesn't. Empty stages and folders aren't drawn.
- Stage and folder nodes are group nodes with addresses (`/<domain>/define`, `/<domain>/design/technical-specification`, in brief 55's bare-ID form if it has landed, otherwise the current `/records/...` form). They are labeled as in the nav, open and fold like groups, and are drawn with the folder style.
- Products keep their children as the nav shows them: Shared, then domains, then open questions and fitness.

**Folders are levels (Jared):** depth counts every level of this tree, stages and folders included, like a file explorer:
- from a domain, depth 1 shows Define and Design, depth 2 their folders, and depth 3 the records in them;
- from a use case, depth 1 is its capability, depth 2 the Capabilities folder, and depth 3 Define;
- the context ring is the next level out.

This replaces "folders come along free" below. Where the text below says folders are free, folders now count.

## Then: depth means tree levels (Jared, after trying depth 2 and 3)
Today depth 1 is the tree (parent and children), but depths 2 and 3 are the old link-hop depths (`neighborhood`, `limit = 2 * (depth - 1)`), so depth 2 does not show grandparents and grandchildren. Jared expects tree levels. Redefine it:
- **Depth N shows N levels of the tree each way, in focus:** ancestors up to N levels and descendants down to N levels. Depth 1 is parent and children; depth 2 adds grandparents and grandchildren; depth 3 one more each way.
  - **Folders and stages are levels** (see above). A capability's use cases are its children directly, by the one-kind rule.
  - **Siblings are not added** by depth. They come from a parent's folder when it is opened, as today.
  - Depth stays 1 to 3, with `+` and `-` as now.
- **Cross-links get their own switch:** a "Links" toggle beside Depth (an `aria-pressed` button with a tooltip and a shortcut `l`), off by default and remembered per tab.
  - When on, it adds the records the **focused record** links to and from, one hop (satisfies, proves, uses, follows and so on, with the relation filters applied), in focus, placed as cross-links are placed today.
  - Their edges are drawn dashed in their own token color (for example `--link-edge`), so they read apart from the tree's solid parent lines.
  - Trace mode (`t`) stays for following a whole chain.
- **Group centers** follow the same rule: depth counts record levels through the group's parent and members.
- **Update the tests and records:**
  - `LA-BRW-UC20-R01`, `UC40-R01` and `UC40-R03`;
  - T50 and T51 (depth by links becomes depth by levels, and the link hops move to the Links switch);
  - T277, T278, T102, and any test that clicks depth 2 or 3 expecting links, which now turns Links on instead.
  - Add tests for depth 2 and 3 levels on a record, a domain and a group, and for the Links switch.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **A context ring.** At every depth, the graph also draws the next ring out, as **context**:
   - At depth 1 that is the tree's next level: the parent's parent (or its folder) and the children's children (or their folders, folded). Hierarchy only, as depth 1 is.
   - At depth 2 and 3 it is the next tree level out each way (depth N+1's levels), hierarchy only. With Links on, the records one hop from the linked records do not join the ring; the ring is the tree's.
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

## More, to serve the intent (Jared: "please add anything else needed to really accomplish that intent")
The intent: a sense of place without noise. Also build:
7. **Hover spotlight.** Hovering or keyboard-focusing a focus node brightens it, its edges and its directly connected nodes, focus or context, and dims the rest a step. Leaving restores the picture. It uses the motion tokens, and under reduced motion it changes at once.
8. **A light ring.** A parent with more than 6 context children shows the first 6 (in the usual order) and a chip node such as "+12 more use cases". Clicking the chip re-centers on that parent's folder for those children (its group address). Chips are context too: faded, out of focus order, and clickable.
9. **Edge hints.** At each canvas edge, a small chip counts the context nodes, of any kind, that lie past that edge ("3 ↑", "8 →"). Clicking a chip pans the camera that way by about half a viewport, using the shared motion, without changing the focus. They update as the camera moves. They are hidden when nothing is past that edge.
10. **Smooth hand-offs.** On a re-center, nodes that go from focus to context fade down and shrink as the camera moves. Nodes that go from context to focus fade up and grow. Nothing pops. It all runs on the brief 39 and 46 motion clock.
11. **Step out and in by keyboard:** Alt+Up (parent), Alt+Down (first child), Alt+Left and Alt+Right (previous and next sibling in order). They are commands in the keymap with tooltips and `aria-keyshortcuts`, and they appear in the shortcuts sheet.
12. **A minimap.** Add a "Minimap" switch under Filters, off by default and remembered per tab. It shows React Flow's `MiniMap` in a corner with focus nodes solid, context faint and the viewport outlined. It is theme-aware through tokens.
13. **The same idea in the Model view (ERD):**
    - On an aggregate's ERD, the entities that its referenced entities refer to appear one ring out, faded and out of focus.
    - On a domain's ERD, the aggregates of other domains that this domain's aggregates refer to are faded context. They are already gray, so fade them too.
    - Apply the same framing (focus only) and edge hints.
14. **Quiet labels.** Context nodes show only their kind and a short title. Their ID and full title appear on hover.
15. **Budget.** At most about 40 context nodes, with chips for the rest. Re-centers stay within the R17 stability budget, and a frame takes under 16 ms at depth 3 on Lathe's own spec. Measure it with the stability suite, and report it.

Records: requirements for 7 to 14 under `UC20` (the graph), and under `UC113` (the ERD) for 13, from the next free R numbers. Tests from the T range below.

## Records
- Update `LA-BRW-UC20-R01` (what each depth shows: the context ring) and `UC40-R03` (a group at the center, also with its ring).
- Add domain rules from `LA-BRW-DR300`, components from `LA-BRW-C290`, and tests from `LA-BRW-T540`. The tests cover:
  - the model's ring at each depth, for a record and for a group;
  - context left out of keyboard order and the summary;
  - framing from the focus nodes only;
  - the filter switch.
- Update the tests that assert exact node sets at depth 1 (T277, T102 and others), so they assert focus nodes and context nodes separately.

## Scope
- **You own:** `app/src/graph/**`, `app/src/model/**` (for 13), the graph and model styles in `styles.css`, the step commands in `keymap.ts`, the graph and model tests, and the records above.
- Check which agents are running when you start, and stay out of their files.
- Never use port 5199. Use `npx vite --port 5417` in `app/` and stop it. Run brief 53's stability suite before reporting: re-centers must stay within the R17 budget.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and what you saw in the browser at depth 1, 2 and 3.
