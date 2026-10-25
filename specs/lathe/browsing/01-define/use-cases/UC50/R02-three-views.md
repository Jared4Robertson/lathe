---
id: LA-BRW-UC50-R02
kind: requirement
title: Wiki, Graph and Model are panes toggled on and off, named in the address
parent: LA-BRW-UC50
---
A record, group, product or domain page MUST show its open views as panes side by side, always in the order Wiki, Graph, Model, each with one title bar, as an editor group in VS Code. Wiki, Graph and Model MUST be on/off toggles, `aria-pressed` icon buttons in the View group of the rightmost pane's bar; Model MUST be offered only on a domain, aggregate or entity page. At least one view MUST stay open: turning off the last open view MUST do nothing, and its toggle's tooltip MUST say so. Each pane's bar MUST name its view at its left (its icon and "Wiki", "Graph" or "Model"), with a button that closes the pane when more than one is open. There MUST be no Split mode and no Open beside button. The toggles and buttons MUST have a visible focus ring and their shortcut in their tooltip. The page's title MUST sit at the top of the leftmost open pane. The open views MUST be remembered between visits (local storage) and written to the address as `?view=` and their names, such as `?view=wiki,graph`, so a shared link opens as it was seen; `?view=split` MUST open the wiki and the graph. Switching views MUST NOT lose keyboard focus: when the focused element goes away with its pane, focus MUST move to the toggle of the view just switched.
