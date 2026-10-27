---
id: LA-EXP-C20
kind: component
title: The graph's part of the side bar's Details
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/panel.tsx
links:
  satisfies: [LA-EXP-UC05-R07, LA-EXP-UC05-R11, LA-EXP-UC12-R03]
  depends_on: [LA-EXP-C03, LA-EXP-C09]
---
What the drawn graph connects to the center (and how), the files a trace reaches, and the legend, as long lists, kept apart from the graph's canvas so the side bar loads without the graph. The side bar's Details shows it in the Graph view only.
