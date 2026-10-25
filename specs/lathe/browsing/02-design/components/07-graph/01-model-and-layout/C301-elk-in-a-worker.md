---
id: LA-BRW-C301
kind: component
title: ELK in a web worker
parent: LA-BRW-LAY12
component_type: module
file: app/src/elk.ts
links:
  satisfies: [LA-PAT-APP-UX-R30, LA-BRW-UC117-R11]
---
`elkLayout(graph)`: the one ELK the graph, the Model view and the diagrams share. In a browser it runs ELK in a web worker (`elkjs/lib/elk-api.js` with `elk-worker.min.js`), so a layout never blocks the main thread; without workers (the tests, in jsdom) it runs the bundled copy. It loads on the first layout, so the wiki's first load leaves it out. On the dev server it also spares the first Model view the seconds Vite took to serve the 1.6 MB bundled ELK as a module.
