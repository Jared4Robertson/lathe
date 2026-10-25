# Brief: eliminate jitter everywhere, systematically

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish each phase with your branch ready to merge.

## Goal
Jared: "lets get an agent to work on animations. eliminate jitter everywhere systematically tackle this I know its a large ask."

The motion work so far covers the graph:
- R12 makes motion shared and optional;
- brief 39 moves the edges with their nodes;
- brief 46 turns a re-center into a camera move.

But things still jump. One known case was a header whose height followed its title. Now find and remove jitter everywhere, and keep it out.

## Method (decided)
1. **Measure, don't guess.**
   - Add a stability suite: Playwright with Chromium only, as a dev dependency in `app/`.
   - It starts the built app or a Vite server on a free port (never 5199) and runs scripted scenarios.
   - In each scenario it records the layout shifts (a `PerformanceObserver` for `layout-shift`, including the ones `hadRecentInput` excludes, flagged), long animation frames, and the bounding boxes of key elements before, during and after each interaction.
   - The scenarios cover at least:
     - first load of the product, domain and record pages;
     - navigating between records through the nav, links, graph clicks, Back and quick find;
     - opening and closing the Wiki, Graph and Model panes;
     - the maximize pane command (Ctrl+3);
     - folding and Expand all;
     - dragging each resize gap, and collapsing by drag;
     - graph re-centers at depth 1 to 3, and ERD navigation;
     - a live spec reload while scrolled half-way (edit a spec file during the test);
     - tooltips, quick find, the palette and the inspector;
     - switching theme, once brief 49 lands;
     - the mobile sheets at 375 px, once brief 52 lands.
   - Script: `npm --prefix app run test:stability`. It is too slow for every check run, so add it to the full checks in 00-common-rules as "for UI changes, also run `test:stability`".
2. **Catalog by cause:** write `notes/jitter-audit.md` listing every shift found, with:
   - the scenario;
   - the element;
   - how far it moved, and the CLS value;
   - its cause;
   - its fix;
   - its status.
   
   Rank it by size times how often Jared would hit it. Group it by cause, not by screen.
3. **Fix by cause, across the app.** Typical causes and the fix for each:
   - **Late content:** reserve its size, or use a skeleton.
   - **Text-dependent heights in headers and bars:** a fixed block size, or one line with an ellipsis.
   - **Fonts swapping in:** preload them, with `font-display: optional` or size-adjusted fallbacks.
   - **Lost scroll on re-render or live reload:** keep the scroll by anchoring to the top visible element.
   - **Remounts:** stable keys, and keep the panes and canvases mounted while their content updates.
   - **Measure-then-correct layouts:** measure before the first paint (`useLayoutEffect`), or render hidden until measured.
   - **Tooltips and popovers repositioning after they show:** position them before showing.
   - **Scrollbar width popping in and out:** `scrollbar-gutter: stable` on scroll boxes.
   - **Fold animations:** animate height with the shared motion tokens, or not at all. Never jump and then correct.
   - **Page changes:** where a short cross-fade of the content hides the swap, use the View Transitions API with the shared tokens (R12), only where it helps. Reduced motion jumps.
4. **Guard it.** Add `LA-PAT-APP-CODE-R17`, "Nothing jumps":
   - Every scenario keeps an unexpected-layout-shift budget of 0.01 or less, and key elements never move except by a deliberate, tokened motion.
   - The stability suite enforces it.
   - Also add jsdom-level checks that can catch causes statically, for example that scroll boxes set `scrollbar-gutter`, and that the pane title area has a fixed block size.

## Phases (decided)
- **Phase 1 (now):**
  - the harness;
  - the full audit (measure everything, including the areas you can't fix yet);
  - the fixes in areas no other agent is editing: `app/src/graph/**`, `app/src/model/**`, `app/src/components/**`, `app/src/specs/**`, the related styles, and fonts in `index.html` only if brief 49 has merged (otherwise list it);
  - R17 and its tests.
  
  Finish phase 1 with the branch ready and report. The coordinator merges it and resumes you for phase 2.
- **Phase 2 (after briefs 41 and 52 merge):** the fixes in `app/src/views/**`, `app/src/shell/**`, `App.tsx`, the nav and the mobile sheets, then a full re-measure, with the audit updated to show before and after.

## Records
- Use case `LA-BRW-UC117` "Read and move around without anything jumping" under `LA-BRW-CAP02`, with requirements.
- Domain rules from `LA-BRW-DR240`, components from `LA-BRW-C230` and tests from `LA-BRW-T480`. The stability scenarios are tests with `run_by: app/stability/…`, each proving a requirement or R17.
- R17 goes in the App code pattern.

## Scope
- **Working at the same time:**
  - brief 41 (tabs: `app/src/views`, `app/src/shell`);
  - brief 49 (themes: tokens, `index.html`);
  - brief 50 (`lathe/`);
  - brief 52 (mobile: across the UI, the nav).
  - In phase 1, stay out of `views/`, `shell/`, `App.tsx` and the nav; measure them and list the fixes for phase 2.
- Before you report, merge `main` in, keep both sides, and rerun the full checks plus `test:stability`.
- Never use port 5199. Stop everything you start, including browsers.

## Report
Use the format in 00-common-rules, with your branch and its last commit, the CLS before and after for each scenario, and the phase 2 list.
