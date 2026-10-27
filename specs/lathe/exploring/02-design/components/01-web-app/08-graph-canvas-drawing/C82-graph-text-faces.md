---
id: LA-EXP-C82
kind: component
title: Graph text faces and measure
parent: LA-EXP-LAY09
component_type: module
file: app/src/graph/fonts.ts
links:
  satisfies: [LA-EXP-DR58, LA-EXP-DR59]
  depends_on: [LA-EXP-C66]
---
The faces the canvas draws the graph's text in, from the theme's body and mono stacks (`readGraphFonts`, `fontFor`), and the measure the maps are laid out with: `pageMeasure` waits for the page's fonts and each face to load, then measures with the canvas's own text metrics, each width read once (`canvasMeasure`). The Voronoi worker gets the same measure (`measureSpec`, `workerMeasure`): the stylesheet's @font-face sources, loaded into the worker's own font set, so its layout is measured exactly as the page's.
