---
id: LA-BRW-C57
kind: component
title: The graph's part of the side bar's Details
parent: LA-BRW-LAY14
component_type: react component
file: app/src/graph/panel.tsx
links:
  satisfies: [LA-BRW-UC50-R07, LA-BRW-UC50-R11, LA-BRW-UC119-R03]
  depends_on: [LA-BRW-C20, LA-BRW-C34]
---
What the drawn graph connects to the center (and how), the files a trace reaches, and the legend, as long lists, kept apart from React Flow so the side bar loads without the graph. The side bar's Details shows it in the Graph view only.
