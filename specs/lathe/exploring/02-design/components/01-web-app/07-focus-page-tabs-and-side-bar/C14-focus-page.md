---
id: LA-EXP-C14
kind: component
title: "Focus page: Wiki, Graph and Model panes"
parent: LA-EXP-LAY08
component_type: react component
file: app/src/views/FocusPage.tsx
links:
  satisfies: [LA-EXP-UC05-R01, LA-EXP-UC05-R02, LA-EXP-UC05-R03, LA-EXP-UC05-R04, LA-EXP-UC05-R05, LA-EXP-UC05-R06, LA-EXP-UC05-R11, LA-EXP-DR09, LA-EXP-DR10, LA-PLT-DR03, LA-PLT-UC04-R02, LA-PLT-UC04-R06, LA-EXP-UC05-R13, LA-EXP-UC11-R01, LA-PLT-UC06-R01, LA-PLT-UC06-R02, LA-PAT-APP-UX-R06, LA-PAT-APP-UX-R03, LA-PLT-UC08-R02, LA-PLT-UC08-R04, LA-PLT-UC08-R05, LA-PLT-DR16]
  implements: [LA-EXP-V03, LA-EXP-V04]
  depends_on: [LA-EXP-C13, LA-EXP-C15, LA-EXP-C11, LA-EXP-C08, LA-PLT-C12, LA-EXP-C48, LA-EXP-C44, LA-EXP-C45, LA-PLT-C28, LA-PLT-C29]
---
The page for one record, group, product or domain: its open views as panes side by side in the order Wiki, Graph, Model (Model only where it is offered), under one page bar (`app/src/views/PageBar.tsx`: the tab strip at its left; the View toggles, a divider and the side bar toggle at its right), each pane a panel with one slim header (its view's name; its Close when more than one pane is open and its full screen button, all icon buttons), the page title at the top of the leftmost pane (one fixed height above a graph or a model), the wiki pane (its scroll kept per tab), the graph pane (its settings kept per tab), the model pane, a resize handle in every gap with each pane's size a weight kept per tab, full screen for any pane, the view commands and the tab commands (keep, close, next and previous). On a phone (`PhoneLayout`) it shows one view at a time under the page bar, compact, with the side bar and the open pages as bottom sheets. `app/src/views/address.ts` reads and writes the open views in the address.
