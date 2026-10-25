---
id: LA-BRW-UC50-R02
kind: requirement
title: Each pane's view toggles switch between Wiki and Graph, and Open beside splits them
parent: LA-BRW-UC50
---
A record, group, product or domain page MUST show its views in panes, each with one title bar, as an editor group in VS Code. The bar's left MUST name the pane's view (its icon and "Wiki" or "Graph"). On a single pane, the bar's right MUST hold Wiki and Graph view toggles, icon buttons with a pressed state, then a divider and an Open beside button that splits the page into a Wiki pane and a Graph pane; in a split, each pane keeps its own view, shows no view toggles, and has a button beside its name that closes it. The toggles and buttons MUST have a visible focus ring and their shortcut in their tooltip (Ctrl+1, Ctrl+2, Ctrl+3). The page's title MUST sit at the top of the wiki pane, or of the graph pane when it is alone. The chosen view MUST be remembered between visits (local storage) and written to the address as `?view=wiki|graph|split`, so a shared link opens as it was seen. Switching views MUST NOT lose keyboard focus: when the focused element goes away with its pane, focus MUST move to the pressed view toggle (in a split, which has none, to the graph pane's close button).
