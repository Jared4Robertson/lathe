# Brief: the view switches join the panel icons

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and merge into `main` yourself once the full checks pass, as the common rules say.

## Goal
Each pane's title bar (`app/src/views/FocusPage.tsx`, the `pane` function; styles under "A pane's title bar" in `app/src/styles.css`) shows "Wiki | Graph" as text tabs at its left. The panel icons (Open beside, Full screen, the inspector toggle) sit at its right. Jared wants the view switches next to the other panel icons, in the same style: small icon-only buttons.

## Decisions already made (Jared, and the coordinator's recommendations)
- **Right of the bar, in this order:**
  - the view toggles, as a group labeled "View" with Wiki (book icon) and Graph (graph icon), each an `icon-button` with `aria-pressed`;
  - a thin vertical divider;
  - Open beside, Full screen, and the inspector toggle on the rightmost pane.
- **Toggle style:** the pressed view uses the same "on" look as the inspector toggle (`.inspector-toggle.is-on`). Make that one shared class, for example `.icon-button.is-on`, used by both, so they can't drift apart.
- **Tooltips and keys:** each toggle's tooltip names the view and its shortcut ("Wiki view Ctrl+1"). `aria-keyshortcuts` comes through `Tooltip` as now.
- **Left of the bar:** a quiet, non-interactive label naming what the pane shows, its icon plus "Wiki" or "Graph", like an editor tab's name. In a split, the pane's close button follows it.
- **In a split,** each pane keeps its own view: the view toggles are not shown, as now. Keep Open beside, Close, Full screen and the inspector toggle where they are.
- **Focus:** when the focused element goes away with a pane, focus goes to the pressed view toggle.
- **R11:** update `specs/lathe/patterns/PAT-app-code/R11-pane-title-bar.md`: the bar names its view at the left and holds the view toggles and layout actions at the right, as icon buttons in one style. Update the T298 test in `app/test/standards.test.tsx` to match. View toggles must be `aria-pressed` icon buttons inside `.pane-actions`.

## What to build
1. The bar change above, in FocusPage and styles.css.
2. **Tests:** update the tests that find the views by `role="tab"` to find the toggles (`within(group 'View') getByRole('button', { name: 'Wiki' | 'Graph' })` with `aria-pressed`). These are in `views.test.tsx`, `shortcut-hints.test.tsx`, `nav.test.tsx`, `graph/GraphPage.test.tsx` and `standards.test.tsx`.
3. **Records:** update `LA-BRW-UC50-R02`, `LA-BRW-T121`, `LA-BRW-C51`, `LA-BRW-C108`, `LA-BRW-UC20-R07` and `LA-BRW-C76` where they say "tabs". Add any new test from `LA-BRW-T310` (brief 39 uses T299–T309), proving R11 and UC50-R02.

## Scope
- **You own:** `app/src/views/FocusPage.tsx`, the title-bar part of `app/src/styles.css`, the tests above and the records above.
- **Working at the same time:** another agent (brief 39, graph connector motion) is editing `app/src/graph/**`, other parts of `styles.css` (motion tokens and transitions) and `app/test/standards.test.tsx` (a new R12 test). Stay out of the graph code.
- **When you merge:** merge `main` into your branch first. If brief 39 landed, keep both sides in `styles.css` and `standards.test.tsx`, and rerun the full checks before merging into `main`.
- Never use port 5199. To look at the app, use `npx vite --port 5406` in `app/` and stop it.

## Checks
- The full checks in 00-common-rules, then merge into `main`.

## Report
Use the format in 00-common-rules, and include the merge commit.
