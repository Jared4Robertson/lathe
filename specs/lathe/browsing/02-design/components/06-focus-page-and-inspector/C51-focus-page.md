---
id: LA-BRW-C51
kind: component
title: "Focus page: Wiki, Graph and Model panes"
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/FocusPage.tsx
links:
  satisfies: [LA-BRW-UC50-R01, LA-BRW-UC50-R02, LA-BRW-UC50-R03, LA-BRW-UC50-R04, LA-BRW-UC50-R05, LA-BRW-UC50-R06, LA-BRW-UC50-R11, LA-BRW-DR51, LA-BRW-DR52, LA-BRW-DR53, LA-BRW-UC51-R02, LA-BRW-UC51-R06, LA-BRW-UC50-R13, LA-BRW-UC113-R01, LA-BRW-UC111-R01, LA-BRW-UC111-R02]
  implements: [LA-BRW-V04, LA-BRW-V20]
  depends_on: [LA-BRW-C50, LA-BRW-C52, LA-BRW-C41, LA-BRW-C33, LA-BRW-C61, LA-BRW-C162]
---
The page for one record, group, product or domain: its open views as panes side by side in the order Wiki, Graph, Model (Model only where it is offered), each a panel with one title bar (the view's name and, when more than one is open, Close at the left; on the rightmost pane the View toggles, a divider, its full screen button and the inspector toggle at the right; on the others their full screen button, all icon buttons), the page title at the top of the leftmost pane (one fixed height above a graph or a model), the wiki pane, the graph pane (its settings kept for the session), the model pane, a resize handle in every gap with each pane's size remembered as a weight, full screen for any pane, and the view commands. `app/src/views/address.ts` reads and writes the open views in the address.
