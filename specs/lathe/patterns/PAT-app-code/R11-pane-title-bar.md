---
id: LA-PAT-APP-CODE-R11
kind: pattern_rule
title: Each pane has one title bar that holds its views and layout actions
parent: LA-PAT-APP-CODE
---
A pane that shows content (the wiki, the graph) MUST be a panel whose first child is its one title bar (`pane-bar`), as an editor group's in VS Code: its view tabs (`role="tab"`) at the left, its layout actions (open beside, close, full screen, and on the rightmost pane the inspector toggle) at the right. View switches and layout actions MUST NOT appear anywhere else on the page, such as a header band above the panes or a button floating over a pane. The page's title belongs to the content: it sits at the top of the pane that shows it.
