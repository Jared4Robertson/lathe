---
id: LA-EXP-C60
kind: component
title: ELK in a web worker
parent: LA-EXP-LAY02
component_type: module
file: app/src/elk.ts
links:
  satisfies: [LA-PAT-APP-UX-R11, LA-PLT-UC08-R11]
---
`elkLayout(graph)`: the one ELK the Model view uses (the graph lays itself out without it, `LA-EXP-C04`). In a browser it runs ELK in a web worker (`elkjs/lib/elk-api.js` with `elk-worker.min.js`), so a layout never blocks the main thread; without workers (the tests, in jsdom) it runs the bundled copy. It loads on the first layout, so the wiki's first load leaves it out. On the dev server it also spares the first Model view the seconds Vite took to serve the 1.6 MB bundled ELK as a module.
