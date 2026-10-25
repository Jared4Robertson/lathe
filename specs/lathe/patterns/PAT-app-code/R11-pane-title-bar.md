---
id: LA-PAT-APP-CODE-R11
kind: pattern_rule
title: Each pane has one title bar that names its view; the rightmost holds the view toggles and the inspector toggle
parent: LA-PAT-APP-CODE
---
A pane that shows content (the wiki, the graph, the model) MUST be a panel whose first child is its one title bar (`pane-bar`), as an editor group's in VS Code. At its left, a quiet label that is not a control names what the pane shows (its icon and "Wiki", "Graph" or "Model", like an editor tab's name), followed, when more than one pane is open, by the button that closes the pane. At its right (`pane-actions`), all as icon buttons in one style (`icon-button`): on the rightmost pane only, the view toggles, a group labeled "View" whose buttons carry `aria-pressed`, then a thin divider; on every pane its full screen button; and on the rightmost pane the inspector toggle. So the View toggles and the inspector toggle appear once on the page. A toggle that is on, an open view or a shown inspector, MUST use the one shared on look (`icon-button is-on`). View switches and layout actions MUST NOT appear anywhere else on the page, such as a header band above the panes or a button floating over a pane. The page's title belongs to the content: it sits at the top of the leftmost open pane.
