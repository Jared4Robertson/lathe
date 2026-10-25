---
id: LA-BRW-C51
kind: component
title: "Focus page: Wiki, Graph and Model panes"
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/FocusPage.tsx
links:
  satisfies: [LA-BRW-UC50-R01, LA-BRW-UC50-R02, LA-BRW-UC50-R03, LA-BRW-UC50-R04, LA-BRW-UC50-R05, LA-BRW-UC50-R06, LA-BRW-UC50-R11, LA-BRW-DR51, LA-BRW-DR52, LA-BRW-DR53, LA-BRW-UC51-R02, LA-BRW-UC51-R06, LA-BRW-UC50-R13, LA-BRW-UC113-R01, LA-BRW-UC111-R01, LA-BRW-UC111-R02, LA-PAT-APP-UX-R06, LA-PAT-APP-UX-R03, LA-BRW-UC116-R02, LA-BRW-UC116-R04, LA-BRW-UC116-R05, LA-BRW-DR221]
  implements: [LA-BRW-V04, LA-BRW-V20]
  depends_on: [LA-BRW-C50, LA-BRW-C52, LA-BRW-C41, LA-BRW-C33, LA-BRW-C61, LA-BRW-C162, LA-BRW-C151, LA-BRW-C152, LA-BRW-C210, LA-BRW-C211]
---
The page for one record, group, product or domain: its open views as panes side by side in the order Wiki, Graph, Model (Model only where it is offered), under one page bar (`app/src/views/PageBar.tsx`: the tab strip at its left; the View toggles, a divider and the side bar toggle at its right), each pane a panel with one slim header (its view's name; its Close when more than one pane is open and its full screen button, all icon buttons), the page title at the top of the leftmost pane (one fixed height above a graph or a model), the wiki pane (its scroll kept per tab), the graph pane (its settings kept per tab), the model pane, a resize handle in every gap with each pane's size a weight kept per tab, full screen for any pane, the view commands and the tab commands (keep, close, next and previous). On a phone (`PhoneLayout`) it shows one view at a time under the page bar, compact, with the side bar and the open pages as bottom sheets. `app/src/views/address.ts` reads and writes the open views in the address.
