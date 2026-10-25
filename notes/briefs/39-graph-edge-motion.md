# Brief: connectors move with the nodes when the graph re-centers

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and merge into `main` yourself once the full checks pass, as the common rules say.

## Goal
When Jared clicks a node, the graph re-centers and the nodes glide to their new places: `.graph-flow .react-flow__node { transition: transform 320ms ease }` in `app/src/styles.css`. He likes it. The connectors (edges) don't move with them: they jump to the new picture straight away. He wants the edges to animate too, so the whole picture moves as one.

## What to know first
- `styles.css` already sets `transition: d 320ms ease` on `.graph-flow .react-flow__edge-path.graph-edge`, but it has no visible effect.
- Find out why before choosing a fix. Likely causes:
  - the edge `<path>` is remounted (its key or id changes);
  - React Flow swaps the elements;
  - the endpoints come from the layout result all at once;
  - the arrow markers don't follow;
  - the browser in use doesn't transition `d`. Safari doesn't, so a CSS-only fix would not be enough.
- Edges are drawn by `GraphEdgeView` in `app/src/graph/GraphPage.tsx`, as straight lines between two points from `boxExit` in `app/src/graph/layout.ts`.

## Decisions already made (Jared, and the coordinator's recommendations)
- **One motion:** edges move exactly as their nodes do, with the same duration and easing, so each end stays attached to its node box throughout.
  - The recommended way is to tween each edge's two points in JS (requestAnimationFrame, the same easing as the nodes), from where it was drawn to where it goes. That works in every browser, unlike transitioning `d`.
  - If you find a simpler way that keeps the ends attached in Chromium and Safari, use it and say why.
- **Edges that persist** (same source, relation and target) move from their old path to the new one. **New edges** fade in, and **removed edges** fade out, over the same duration. Their labels move or fade with them.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, nothing animates. Nodes and edges jump, as today.
- **Make it a shared standard** (Jared wants standards created proactively). Add `LA-PAT-APP-CODE-R12` "Motion is shared and optional":
  - Every transition and animation uses the shared motion tokens in `:root`: `--motion-speed` (320ms) and `--motion-ease`, plus the existing `--hover-speed` for hover.
  - Every one is turned off under `prefers-reduced-motion`.
  - JS animation reads the same values and checks `matchMedia('(prefers-reduced-motion: reduce)')`.
  - Prove it in `app/test/standards.test.tsx` with a test that reads `styles.css`. Every `transition` or `animation` value must use `var(--motion-…)` or `var(--hover-speed)`, and every selector with a transition must be covered by a reduced-motion rule. Also convert any existing transitions that break the rule.

## What to build
1. The edge animation as decided, with a small, testable helper (for example `tweenEdge(from, to, t)` in `app/src/graph/layout.ts` or a new `motion.ts`) plus the component wiring.
2. The motion tokens, R12 and its test, and conversion of the existing transitions.
3. **Lathe's own spec (LA-BRW):**
   - A requirement under the graph use case that best fits. Look in `specs/lathe/browsing/01-define/use-cases/` (UC20 or UC40). Use the next free R number, saying the picture moves as one when it re-centers (nodes and edges together, new edges fading in, old ones out, still under reduced motion).
   - Domain rules from `LA-BRW-DR147`, components from `LA-BRW-C148` (placed in layer `LA-BRW-LAY07` Graph, or `LAY08` for a shared motion helper), and tests from `LA-BRW-T299`.
   - The rule `LA-PAT-APP-CODE-R12` under `specs/lathe/patterns/PAT-app-code/`, added to the pattern's list.
   - Everything satisfied and proved, with no `too-many-children` or `lone-child` warnings.
4. **Tests:** unit tests for the tween (endpoints at t=0, 0.5 and 1, the easing, persist, enter and leave), and a component test that a persisting edge keeps its element across a re-center and that reduced motion skips the tween. Pointer animation itself can't be seen in jsdom, so look at it in the browser (`npx vite --port 5405` in `app/`, then stop it).

## Scope
- **You own:** `app/src/graph/**`, `app/src/styles.css`, `app/test/**` and the records named above.
- Nobody else is working in the repo right now.

## Checks
- The full checks in 00-common-rules, then merge into `main`.

## Report
Use the format in 00-common-rules, and include the merge commit. Say what was wrong with the existing `d` transition, and how you looked at the motion in the browser.
