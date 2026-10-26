---
id: LA-PAT-APP-UX-R03
kind: pattern_rule
title: The page bar holds the page's tabs and layout controls; each pane's header holds only that pane's actions
parent: LA-PAT-APP-UX
group: Layout
---
A tab is a page and the panes are views of it, so the page's controls and each pane's controls MUST sit apart, as in VS Code's editor area:

- **The page bar:** one panel strip (`page-bar`) across the top of the open panes, inside the focus layout, covering neither the nav nor the side bar. At its left, the page's tabs (`role="tablist"`). At its right (`page-bar-actions`), the view toggles, a group labeled "View" whose buttons carry `aria-pressed`, then a thin divider, then the side bar toggle at the far right, beside the side bar. It MUST keep one fixed height (`--page-bar-height`), one line whatever it holds, the tabs scrolling sideways, so nothing below it moves.
- **Each pane's header:** a pane that shows content (the wiki, the graph, the model) MUST be a panel whose first child is one slim header (`pane-bar`, `--pane-bar-height`): at its left a quiet label that is not a control names what the pane shows (its icon and "Wiki", "Graph" or "Model"); at its right (`pane-actions`) only that pane's own actions, as icon buttons in one style (`icon-button`): its close button, shown only when more than one pane is open, and its full screen button. No tabs and no view toggles in a pane header.

A toggle that is on, an open view or a shown side bar, MUST use the one shared on look (`icon-button is-on`). View switches and layout actions MUST NOT appear anywhere else on the page, such as a row of their own or a button floating over a pane. The page's title belongs to the content: it sits at the top of the leftmost open pane.

On a phone the page bar is the same bar, compact (`page-bar is-compact`), under the shell's top bar: an "Open pages" button that opens the tabs as a sheet takes the tabs' place, the View group shows one view at a time, and the side bar toggle stays at the far right; the panes have no headers, as only one shows.
