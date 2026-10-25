---
id: LA-EXP-C15
kind: component
title: The side bar
parent: LA-EXP-LAY08
component_type: react component
file: app/src/views/SideBar.tsx
links:
  satisfies: [LA-EXP-UC05-R11, LA-PLT-DR03, LA-EXP-UC12-R01, LA-EXP-UC12-R02, LA-EXP-UC12-R06, LA-EXP-DR55]
  depends_on: [LA-EXP-C61, LA-EXP-C62, LA-EXP-C63]
---
The page's last column, as VS Code's secondary side bar: the switcher of Details, Outline and History at its top (a labeled group of `aria-pressed` icon buttons), the hide button, and the view shown under its own heading. It works out what Details describes from the node under the pointer or selected, which the graph, the Model view and the wiki's rows tell it through a small store (`app/src/views/sideBarState.ts`, so a hover redraws only the side bar), and keeps the view mode's open state and view per tab and as last used. Its styles are `app/src/views/SideBar.css`.
