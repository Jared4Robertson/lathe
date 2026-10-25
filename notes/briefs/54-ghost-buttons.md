# Brief: actions are ghost buttons, links stay links

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after briefs 41 (tabs), 52 (mobile) and 53 phase 1 (jitter) have merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared: "generally can we replace link buttons with ghost buttons."

Standalone actions are styled as links today, for example "Open the product overview" and "Open the domain overview" (`app/src/specs/RecordContent.tsx`). Secondary buttons, meanwhile, use three different styles: Cancel and "Clear filters" are outlined (`.secondary`), "Expand all" is bordered (`.tree-bulk`), and the pane bar's icon buttons are ghost-style.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **One `Button` component** (`app/src/components/Button.tsx`) with three variants:
   - **`ghost`**, the default for standalone actions: no border or fill, padded, `--hover-bg` on hover, the shared focus ring, an optional leading icon, and 44 px targets on coarse pointers (UX-R07);
   - **`primary`**: filled with the accent, used for the one main action of a form or dialog;
   - **`icon`**: a square ghost button with an accessible name, which the pane bar, nav and inspector icon buttons become.
   
   It renders a `<button>`, or a real link styled as a button when it navigates (`href`/`to`), so Cmd-click still works.
2. **What changes:**
   - every standalone link that acts as a control: "Open the … overview", any "See all …" that stands alone (not inside a sentence), and empty-state calls to action;
   - every `.secondary` button;
   - "Expand all" and "Collapse all";
   - the graph toolbar's buttons where they are text actions;
   - dialog actions: Cancel is ghost, Create is primary;
   - the Appearance page's actions, once brief 49 has landed.
3. **What stays a link:** links inside prose (Markdown, sentences), links inside lists and rows (record references, UX-R05 row links), breadcrumbs and trails, and nav items. These are navigation in context, not controls.
4. **Clean up:** delete `.secondary`, `.tree-bulk` and the scattered text-button rules in favor of the component's classes.
5. **Proactive standard:** add `LA-PAT-APP-UX-R09`, "Actions look like actions" (in the App experience pattern, brief 63): standalone actions use `Button` (ghost by default, primary for the main action), and links are kept for navigation in context.
   - Prove it in `app/test/standards.test.tsx`: render the main pages and expect no `p > a:only-child` used as a standalone action, no `button.secondary` or `.tree-bulk`, and every `<button>` outside the component to be one of an allowed list (tabs, toggles in groups, tree chevrons). If that list would be long, move those into the component too.

## Records
- Rule UX-R09 in the App experience pattern (`LA-PAT-APP-UX`, brief 63).
- A Browsing domain rule from `LA-BRW-DR260`, a component from `LA-BRW-C250` (layer `LAY08`, Shared components) and tests from `LA-BRW-T500`.
- Update the records that describe the changed controls.

## Scope
- **You own:** `app/src/components/Button.tsx`, and the call sites across `app/src/**`, limited to the button changes.
- Check which other agents are running when you start, and keep your changes at the call sites small, so merges stay easy.
- Never use port 5199. Use `npx vite --port 5415` in `app/` and stop it.
- If brief 53's stability suite exists, run it before reporting.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the list of changed call sites.
