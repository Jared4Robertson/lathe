---
id: LA-BRW-C51
kind: component
title: "Focus page: Wiki, Graph and Split views"
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/FocusPage.tsx
links:
  satisfies: [LA-BRW-UC50-R01, LA-BRW-UC50-R02, LA-BRW-UC50-R03, LA-BRW-UC50-R04, LA-BRW-UC50-R05, LA-BRW-UC50-R06, LA-BRW-UC50-R11, LA-BRW-DR51, LA-BRW-DR52, LA-BRW-DR53, LA-BRW-UC51-R02, LA-BRW-UC51-R06]
  implements: [LA-BRW-V04, LA-BRW-V20]
  depends_on: [LA-BRW-C50, LA-BRW-C52, LA-BRW-C41, LA-BRW-C33, LA-BRW-C61]
---
The page for one record, group, product or domain: its panes, each a panel with one title bar (view tabs, Open beside or Close, full screen, and on the rightmost pane the inspector toggle), the page title at the top of the wiki pane (or a lone graph pane), the wiki pane (record content, a product or domain overview, or a group page), the graph pane (the hostable graph view, its settings kept for the session), the split divider, full screen for either pane, and the view commands.
