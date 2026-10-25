---
id: LA-BRW-C57
kind: component
title: The graph's part of the inspector
parent: LA-BRW
component_type: react component
file: app/src/graph/panel.tsx
links:
  satisfies: [LA-BRW-UC50-R07, LA-BRW-UC50-R11]
  depends_on: [LA-BRW-C20, LA-BRW-C34]
---
What the drawn graph connects to the center (and how), the files a trace reaches, and the legend, as long lists, kept apart from React Flow so the inspector loads without the graph.
