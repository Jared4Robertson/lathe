# Brief: re-centering the graph moves the camera, not the picture

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge, as the common rules say.

## Goal
When Jared clicks a node, the graph lays out a new picture with the new focus at the origin. Nearly every node then glides somewhere new, which reads as a big jump or jitter. He wants it to feel like the camera reframing onto the node: the world stays put, and the view moves.

## What exists
- `app/src/graph/GraphPage.tsx`, the `GraphCanvas` component: the layout comes from `layoutNeighborhood` (`app/src/graph/layout.ts`), with the focus at (0,0). Fit to view goes through React Flow's `setViewport` or `fitView`.
- `app/src/graph/motion.ts` (brief 39): edges tween with the nodes' CSS transform transition, using the shared motion tokens `--motion-speed` and `--motion-ease`. Under reduced motion everything jumps (R12, DR147, DR148).

## Decisions already made (Jared, and the coordinator's recommendations)
1. **Anchor the new layout.** The clicked node keeps its old position in world coordinates: shift the whole new layout by `old position − new position` of the clicked node.
   - Records in both pictures should then move little. Where they still move, they glide as now.
   - Back, the trail, and keyboard Enter re-center the same way: anchor on the new focus if it was on screen, otherwise the current behavior.
2. **Move the camera.** After the anchored layout lands, animate the viewport (pan, and zoom when the new picture needs a different scale to fit) to frame the new focus. Use React Flow's `setViewport` or `fitView` with `duration` and the shared easing.
   - The node motion and the camera motion start together and last the same time (`--motion-speed`, read as in brief 39).
   - On the first picture of a page there's no animation.
3. **Records entering and leaving fade.** Nodes new to the picture fade in at their place, and nodes leaving fade out, as edges already do. Edges follow as now.
4. **Reduced motion:** nothing animates, as R12 says. The new picture appears at once, framed on the focus.
5. **The camera keeps hands off:** if Jared has zoomed or panned by hand, a re-center still frames the new focus, but it starts from where his view is, never snapping back first.
6. **Keep it stable:** no layout jitter between two renders of the same picture. Node positions must be deterministic for the same graph and anchor.

## Records and tests
- **Requirement:** extend `LA-BRW-UC20-R09` (the picture moves as one), or add the next free R under UC20, saying the re-center anchors on the clicked node and moves the camera, and new and leaving records fade.
- **IDs:** domain rules from `LA-BRW-DR180`, components (layer `LAY07`) from `LA-BRW-C170`, and tests from `LA-BRW-T380`.
- **Unit tests:** the anchoring math (the clicked node's world position is unchanged; a translated layout is otherwise identical) and the fade sets (entering and leaving).
- **Component test:** a re-center calls the viewport animation with the shared duration, and doesn't under reduced motion.
- **Browser check:** look at it with `npx vite --port 5410` in `app/`, logging the clicked node's screen position across frames. It should move smoothly from the click point to the center, with no jump. Stop the server afterwards.

## Scope
- **You own:** `app/src/graph/**`, the graph part of `app/src/styles.css`, the graph tests, and the records above.
- **Working at the same time:**
  - Brief 45 (the Model view and panes) works in `app/src/model/**`, `app/src/views/**` and `styles.css`. It may reuse the graph's motion.
  - Briefs 43 and 44 (entities) work outside `app/`.
  - Before you report, merge `main` in, keep both sides, and rerun the full checks.

## Report
Use the format in 00-common-rules, with your branch and its last commit (the coordinator merges), and what you saw in the browser.
