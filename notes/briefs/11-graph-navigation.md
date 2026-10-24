# Brief: graph navigation in the web app

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Jared wants to navigate Lathe as a graph as well as a wiki: start from any record, see what it connects to, and walk the model by clicking from node to node, the way the record pages let him click from link to link. The graph should make the shape of a domain and its traceability (requirement to component to test) visible at a glance.

## What to build
1. **A graph view** at `/graph/<record-id>` (and `/graph` opening the product list or the first product), drawn from the same `GET /api/spec` workspace the spec pages use (see `app/src/specs/data.ts`):
   - **Ego graph:** the focused record in the centre and its neighbours within a depth of 1 or 2 hops (a control switches depth, default 1), following both outgoing and incoming links and the parent/child relation.
   - **Walk by clicking:** clicking a node re-centres the graph on it and updates the address, so the browser's Back button walks back along the path. A breadcrumb trail shows the last records visited.
   - **Side panel:** the focused record's kind, title, first lines of its body, its problems and coverage gaps, and an "Open page" link to `/records/<id>`.
   - **Encode meaning in form:** node colour or shape by kind (grouped by stage: Define, Design, structural), edge style by relation, and a visible mark on records that have errors or coverage gaps. Include a small legend.
   - **Filters:** toggle kinds and relations on and off (for example hide tests, or show only satisfies/proves).
   - **Trace mode:** for a requirement or domain rule, a toggle that shows only its traceability chain: what fulfills it, which components satisfy it, which tests prove them, and the files they name.
   - **Keyboard:** arrow keys or Tab move between neighbours, Enter re-centres, Escape clears filters; focus is always visible.
2. **Entry points:** an "Open in graph" link on every record page and domain page, and a **Graph** item in the menu.
3. Layout: React Flow with ELK (already in the app). Choose a layout that keeps the focused node central and stable when re-centring (for example ELK's `stress` or `radial`, or layered with the focus in the middle); animate or at least keep positions predictable. Keep it fast with 200+ records in the workspace.
4. Tests: vitest + jsdom + `@testing-library/react` for the pure graph logic (neighbourhood at depth 1 and 2, filters, trace chain) and for clicking a node changing the focus and address. The browser agent is setting up this test tooling in `app/` in parallel; if it is not in your branch, add the minimum yourself and expect to reconcile it at the end.
5. Lathe's own spec: add records under `specs/lathe/browsing/` for graph navigation, using only these ID ranges so nothing collides with the other agent: use cases `LA-BRW-UC20` onwards (with their requirements), domain rules `LA-BRW-DR20` onwards, views `LA-BRW-V20` onwards, components `LA-BRW-C20` onwards, tests `LA-BRW-T50` onwards. Every new requirement and rule is satisfied and proved.

## Scope
- Read first: `app/src/**` (especially `specs/data.ts`, `specs/SpecPages.tsx`, `specs/DomainGraph.tsx`, `router.tsx`, `App.tsx`, `layout.ts`), `lathe/src/types.ts`, `lathe/FORMAT.md`.
- You own: `app/src/graph/**` (new), `app/test/graph/**` (new), and new files under `specs/lathe/browsing/` in the ID ranges above. You may make small edits to `app/src/App.tsx` (route and menu item), `app/src/specs/SpecPages.tsx` (the "Open in graph" links) and `app/src/styles.css` (append a clearly marked graph section): another agent is changing these files in parallel, so keep your edits small and in one place each.
- Out of scope: the engine, other specs, the Diagrams feature (keep it working).

## Finishing
Before your final report: run `git merge pass-3` in your worktree to pick up whatever has been merged since you started (the browser agent's work may be there by then), resolve any conflicts so that both features work, and rerun your checks after the merge.

## Checks
`cd app && npx tsc --noEmit`, the app tests, `npm --prefix lathe run check` (0 errors; your new records fully covered). If you look at it in a browser, use `LATHE_SPEC_FIXTURE=1 npx vite --port 5360` in `app/` (or without the flag to see the real workspace) and stop it after. Never use port 5199.
