---
id: LA-PAT-APP-CODE-R11
kind: pattern_rule
title: Each pane has one title bar that names its view and holds the view toggles and layout actions
parent: LA-PAT-APP-CODE
---
A pane that shows content (the wiki, the graph) MUST be a panel whose first child is its one title bar (`pane-bar`), as an editor group's in VS Code. At its left, a quiet label that is not a control names what the pane shows (its icon and "Wiki" or "Graph", like an editor tab's name), followed in a split by the button that closes the pane. At its right (`pane-actions`), all as icon buttons in one style (`icon-button`): the view toggles, a group labeled "View" whose buttons carry `aria-pressed`, then a thin divider, then the layout actions (open beside, full screen, and on the rightmost pane the inspector toggle). A toggle that is on, the pressed view or a shown inspector, MUST use the one shared on look (`icon-button is-on`). View switches and layout actions MUST NOT appear anywhere else on the page, such as a header band above the panes or a button floating over a pane. The page's title belongs to the content: it sits at the top of the pane that shows it.
