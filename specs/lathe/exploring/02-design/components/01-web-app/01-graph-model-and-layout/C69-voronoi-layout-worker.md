---
id: LA-EXP-C69
kind: component
title: Voronoi layout worker
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/voronoi.worker.ts
links:
  satisfies: [LA-EXP-UC03-R17, LA-PAT-APP-UX-R11]
  depends_on: [LA-EXP-C68]
---
The web worker the Voronoi map is laid out in: it takes a product's tree as `voronoiTree` reads it and sends back the map `layoutTreeOf` makes, so the few hundred milliseconds a large product's power diagrams take never block the page.
