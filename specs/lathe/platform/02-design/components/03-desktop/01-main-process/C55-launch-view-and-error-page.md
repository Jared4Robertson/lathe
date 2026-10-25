---
id: LA-PLT-C55
kind: component
title: Launch view and error page
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/launch.ts
links:
  satisfies: [LA-PLT-UC15-R05, LA-PLT-UC15-R10, LA-PLT-UC15-R11, LA-PLT-DR39]
  depends_on: [LA-PLT-C40, LA-PLT-C56]
---
The models of the shell's own pages: the launch view and the error page (`static/launch.html`), drawn over a window's app page in a `WebContentsView` until the page's `data-specs` says ready or error, and the About window (`static/about.html`). The main process shows the launch view at once, in the last theme's shell color (`chrome.json`), lifts it when the specs answer, and shows the error page with the engine's message when they fail. `parseLocalAction` lets a page run only the buttons it shows.
