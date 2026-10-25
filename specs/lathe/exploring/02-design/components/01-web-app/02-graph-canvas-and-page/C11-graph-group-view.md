---
id: LA-EXP-C11
kind: component
title: Graph group nodes and the hostable graph view
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-EXP-UC04-R01, LA-EXP-UC04-R02, LA-EXP-UC04-R03, LA-EXP-UC04-R04, LA-EXP-UC04-R06]
  depends_on: [LA-EXP-C10, LA-EXP-C05]
---
The folder-shaped group node with its name, count and marks; the side bar for a focused group; the legend entry. `GraphView` takes `focus`, `onNavigate` and `hrefFor`, so any pane can host it, and it frames the focus again whenever its container is resized.
