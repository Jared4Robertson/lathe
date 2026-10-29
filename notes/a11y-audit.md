# Accessibility audit

The accessibility suite (`app/a11y`, `npm --prefix app run test:a11y`, rule `LA-PAT-APP-UX-R10`) runs axe-core at WCAG 2.2 AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on every page and state the stability suite visits, and walks the keyboard paths axe can't check. Each page or state in each look is one test.

- **Pages:** product, domain, record and group pages; the graph; the ERD view; Checks; Format; Appearance.
- **States:** quick find, the command palette, the shortcuts sheet and a tooltip on a wide screen; the nav drawer, the quick find sheet and the inspector sheet on a phone. The side bar (the inspector) is open beside the graph and the ERD view.
- **Widths and looks:** 1440 px and 375 px (touch), each in Lathe light, Lathe dark, High contrast light and High contrast dark, with reduced motion so colors are read at rest.
- **Keyboard** (`keyboard.spec.ts`): Tab round the whole page and back with no trap; the main tasks by keyboard (open a record from the nav and from quick find, switch views, re-center the graph, fold a row, hide, show and focus the inspector, pick a theme); focus after a move and back on the opener when a dialog or a sheet closes; the announcer's words.

The findings are grouped by axe rule below, with each one's cause and fix. `app/a11y/results/summary.json` (ignored by git) holds the latest run's findings.

## Before and after

| Rule | Impact | Before: states (elements) | After |
| --- | --- | --- | --- |
| `label-content-name-mismatch` | serious | 68 (6) | 0 |
| `nested-interactive` | serious | 36 (1) | 0 |
| `target-size` | serious | 28 (9) | 0 |
| `scrollable-region-focusable` | serious | 20 (4) | 0 |
| `color-contrast` | serious | 4 (8) | 0 |
| `aria-required-children` (found while fixing the tab strip) | critical | 0 | 0 |
| Keyboard: focus on first load | - | the first Tab skipped the skip link | 0 |

Before: 156 findings in 5 rules; 94 of the 100 audit tests failed (on a phone, the product, domain, record and group pages also timed out waiting for the wide layout's pane title, so they were first audited after the scenario was fixed, and passed). After: 0 findings; the 100 audits and the 9 keyboard scenarios pass.

## `label-content-name-mismatch`: a control's name did not hold its visible text (WCAG 2.5.3)

`LA-BRW-DR320`. The cause each time was an `aria-label` that said something other than what the control shows.

- **A space's button in the rail** (`app/src/shell/Nav.tsx`) was labeled with the product's title ("Lathe") while it shows its monogram ("LA"). Fix: no `aria-label`; the mark stays `aria-hidden` and the title is hidden text (`sr-only`) inside the link, so the name is still "Lathe" and no label claims to name the mark.
- **The nav's Checks row** was labeled "Checks: 0 errors, 16 warnings" while it shows "Checks 16". Fix: no `aria-label`; each count badge has its word in hidden text beside it, so the name is built from what is shown: "Checks 16 warnings".
- **A page tab** (`app/src/views/TabStrip.tsx`) was labeled "LA-BRW-UC91 See each…" while its visible text ran the ID and title together. Fix: the tab is named by its content, with a space between the ID and the title, and ", preview" in hidden text.
- **The phone's open pages button** (`app/src/views/PageBar.tsx`) was labeled "Open pages (1)" while it shows "1"; axe does not match a number inside parentheses. Fix: "Open pages: 1".

## `nested-interactive`: a control inside another (WCAG 4.1.2)

`LA-BRW-DR321`. **A page tab held its close button**, so a screen reader read the tab as one thing and could not reach the button; a negative `tabindex` does not hide it. Fix: the `.tab` wrapper holds the `role="tab"` element and the close button side by side. A `tablist` may hold only tabs (`aria-required-children` flagged the button once it sat beside the tab), so the close button, which was already out of the Tab order, is also `aria-hidden`: it is for the pointer, and the keyboard closes a tab with Delete or Alt+Shift+W, as before. The focus ring moved from the wrapper to the tab itself.

## `target-size`: targets under 24 px with neighbors too close (WCAG 2.5.8)

`LA-BRW-DR323`. **Record links listed in a Traceability cell** on a record page (`.trace-cell > .record-link`) were 16 px tall with 2 px between rows, so a 24 px circle on one touched the next. Fix: they are 24 px tall (`min-block-size: 24px` in `app/src/styles.css`). The side bar lists a record's links the same way in its Details view (`.side-trace-groups dd`), with 4 px between rows; the same fix is in `app/src/views/SideBar.css`. Links inside sentences are exempt in WCAG and were not flagged.

## `scrollable-region-focusable`: a scroll box the keyboard could not scroll (WCAG 2.1.1)

`LA-BRW-DR322`. Boxes that scroll on their own and hold nothing that takes focus could not be scrolled by keyboard. Each now takes focus (`tabindex="0"`) and has a name:

- Markdown code blocks (`<pre>`, `app/src/specs/Markdown.tsx`) and a kind page's example row in the wiki card (`app/src/format/FormatPages.tsx`), seen on a phone;
- the shortcuts sheet's groups (`app/src/shell/commands.tsx`), a region named "Shortcuts";
- the ERD's key in the ERD view (`app/src/erd/ErdView.tsx`, a one-line attribute);
- the graph's trail on a phone (`app/src/graph/GraphPage.tsx`, a one-line attribute).

## `color-contrast`: muted text on the shell (WCAG 1.4.3)

`LA-BRW-DR324`. Only in Lathe light: on Checks and Appearance, counts and hints in `--muted` (#5A6870) read 4.44:1, short of 4.5:1. The cause was not the color but the surface: those pages are one panel (`main.spec-page.panel`), which had no background, so the text sat on the shell (`--shell`, #DDE3E6) behind the panels, a surface the theme contrast audit does not vouch for. Fix: `.spec-page.panel` draws `--paper`, where muted text reads 5.30:1. No token changed.

## What axe can't see: the keyboard

- **Focus on first load** (`app/src/views/FocusPage.tsx`): the effect that keeps focus on a view toggle when the pane holding focus closes also ran on first load, when focus was on the body, so focus jumped to the Wiki toggle and the first Tab skipped the skip link and the nav. Fix: it runs only when the open panes change.
- **No trap:** Tab goes round the whole record page (wiki and graph open) and back to its first stop, and every stop is drawn.
- **Focus after a move and on close:** after quick find opens a record, focus is on the page; a view toggle and the inspector toggle keep focus when pressed; re-centering the graph by keyboard puts focus on the new center; the palette, the shortcuts sheet and the theme picker take focus, keep Tab inside, and give it back to the opener on Escape; on a phone the nav drawer and the inspector sheet give focus back to their buttons. All of these already held.
- **Announcements:** the announcer says "Graph view", "Inspector hidden", "Inspector shown" and "Color theme: Midnight". These already held.

## Left for later

- The page tab's close button is hidden from screen readers; the tab could announce its Delete shortcut too, but the Tooltip sets the tab's `aria-keyshortcuts` from the keep command, and both would need one attribute.
- The graph's trail is a tab stop on every page with the graph open, even when it does not overflow; making it one only when it scrolls needs a measure in `GraphPage.tsx`.
