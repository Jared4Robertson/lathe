---
id: LA-BRW-C41
kind: component
title: Graph group nodes and the hostable graph view
parent: LA-BRW
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-BRW-UC40-R01, LA-BRW-UC40-R02, LA-BRW-UC40-R03, LA-BRW-UC40-R04, LA-BRW-UC40-R06]
  depends_on: [LA-BRW-C40, LA-BRW-C22]
---
The folder-shaped group node with its count, caret and marks; opening and closing groups on click or Enter and remembering them in the view's state; the side panel for a focused group; the legend entry. `GraphView` takes `focus`, `onNavigate` and `hrefFor`, so the /graph page and any other page can host it, and it fits the picture again whenever its container is resized.
