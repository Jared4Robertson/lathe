---
id: LA-BRW-C52
kind: component
title: The side bar (the inspector)
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/SideBar.tsx
links:
  satisfies: [LA-BRW-UC50-R11, LA-BRW-DR53, LA-BRW-UC119-R01, LA-BRW-UC119-R02, LA-BRW-UC119-R06, LA-BRW-DR340]
  depends_on: [LA-BRW-C310, LA-BRW-C311, LA-BRW-C312]
---
The page's last column, as VS Code's secondary side bar: the switcher of Details, Outline and History at its top (a labeled group of `aria-pressed` icon buttons), the hide button, and the view shown under its own heading. It works out what Details describes from the node under the pointer or selected, which the graph, the Model view and the wiki's rows tell it through a small store (`app/src/views/sideBarState.ts`, so a hover redraws only the side bar), and keeps the view mode's open state and view per tab and as last used. Its styles are `app/src/views/SideBar.css`.
