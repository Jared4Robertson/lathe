# Brief: tabs for open records, like VS Code (stage 1)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after briefs 39 (graph motion) and 40 (view toggles in the panel icons) have merged. Work in your own worktree, and merge into `main` yourself once the full checks pass.

## Goal
Jared wants VS Code-style tabs. A tab is an **open record**: a record, group, domain or product page. Wiki and Graph stay as views of the active tab. With several records open, he can flip between them without losing his place, and each tab keeps its own view, wiki scroll position and graph settings.

This is stage 1: tabs in one pane. Stage 2 is editor groups: each pane with its own tabs and any record, dragging tabs between panes, and today's split becoming "the same record twice". Stage 2 comes later and is out of scope here. Build stage 1 so stage 2 can extend it, for example with a tab model that a group can own.

## Decisions already made (Jared, and the coordinator's recommendations)
- **Preview tabs, as in VS Code:**
  - Opening a page by a plain click (a record link, a graph node, the nav, quick find, or Back and Forward) opens it in the **preview tab**, which has an italic title and replaces itself on the next plain open.
  - A preview tab becomes a **lasting tab** when Jared double-clicks it, runs the "Keep open" command (`keepTab`, Ctrl+K Enter, as in VS Code), or switches its view.
  - At most one preview tab exists. A page already open in a tab activates that tab instead of opening another.
- **Browser conventions stay:** Cmd- or Ctrl-click and middle-click on a link still open a new browser tab. Links keep their real addresses (an existing requirement).
- **The address follows the active tab**, so links, reload, Back and Forward work as now. Back to a page whose tab was closed reopens it as the preview tab.
- **Closing:** each tab has a close button (shown on hover and on the active tab). Middle-clicking a tab closes it. Ctrl+W (`closeTab`) closes the active tab. Closing the active tab activates its neighbor to the right, or else the left. Closing the last tab leaves the page open as a preview tab, so there is always one.
- **Moving between tabs:** Ctrl+Tab and Ctrl+Shift+Tab cycle in tab order. Add them to the keymap with tooltips and `aria-keyshortcuts` like the other commands, and list them in the shortcuts sheet.
- **Remembered:** open tabs, their order, which one is a preview, and each tab's view, wiki scroll and graph settings are kept per space in session storage. Switching spaces swaps the tab set.
- **Where the tabs live:** in the pane title bar, at the left, replacing brief 40's quiet "which view" label. The view toggles and layout actions stay at the right.
  - In the current split, which is one record as Wiki and Graph, the tab strip sits in the left pane's bar, and the right pane's bar names the view.
  - Overflowing tabs scroll sideways (wheel or trackpad), and the active tab scrolls into view.
- **Tab content:** each tab shows the record's kind icon or ID in mono and its title, truncated, with the full ID and title in the tooltip. A group tab shows its label ("Use cases (7)").
- **Accessibility:** `role="tablist"` and `role="tab"` with `aria-selected`; the arrow keys move between tabs when the strip has focus, and Delete closes the focused tab.
- **Proactive standard:** add `LA-PAT-APP-CODE-R13` "Every open thing has an address": anything a person can open (a tab, a view, a panel state worth sharing) is reachable from the address bar or restorable from storage, and reload brings it back. Prove it with a test that reloads with tabs open and expects the same tabs, active tab and views. If you judge a different rule fits better, propose it in your report instead.

## What to build
1. A tab model (`app/src/shell/tabs.ts` or `app/src/views/tabs.ts`): pure functions for open, preview, keep, close, activate and cycle, with unit tests. Plus a hook for the persistence and the address syncing.
2. The tab strip in the pane bar (`app/src/views/FocusPage.tsx`), with styles in the existing pane bar section of `styles.css`. Panel and hover rules R08–R12 apply: hover states, tokens, motion tokens if anything animates, and grid columns.
3. The commands `keepTab`, `closeTab`, `nextTab` and `previousTab` in the keymap and the palette.
4. **Lathe's own spec (LA-BRW):**
   - Use case `LA-BRW-UC112` "Keep several records open in tabs" under `LA-BRW-CAP02`, with requirements.
   - Domain rules from `LA-BRW-DR150`, components from `LA-BRW-C150` (in layers `LAY02` or `LAY06`, as fits), and tests from `LA-BRW-T320`.
   - Add the rule R13 to `PAT-app-code` if you add it.
   - Everything satisfied and proved, with no `too-many-children` or `lone-child` warnings. Add a fresh capability or aggregate if one would pass 15.
   - Add the use case to a flow's `carries_out` (`F04` fits).

## Scope
- **You own:** `app/src/views/**`, `app/src/shell/**`, `app/src/styles.css` (the pane bar and tabs), `app/test/**` and the records above.
- Nobody else is working when you start. If `main` moves, merge it in and rerun the checks before merging.
- Never use port 5199. To look at the app, use `npx vite --port 5407` in `app/` and stop it.

## Checks
- The full checks in 00-common-rules, then merge into `main`.

## Report
Use the format in 00-common-rules, with the merge commit, and a short note on what stage 2 needs from this tab model.
