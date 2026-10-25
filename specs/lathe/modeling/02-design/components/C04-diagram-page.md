---
id: LA-MOD-C04
kind: component
title: Diagram page and form
parent: LA-MOD
component_type: react component
file: app/src/App.tsx
links:
  implements: [LA-MOD-V01, LA-MOD-V02]
  satisfies: [LA-MOD-UC01-R01, LA-MOD-UC02-R03]
  depends_on: [LA-MOD-C05, LA-MOD-C01]
---
`DiagramView` and `NewDiagram` in `App.tsx`: fetch the diagram, render it with React Flow, show the side panel and the check result, and reload on `model:changed`.
