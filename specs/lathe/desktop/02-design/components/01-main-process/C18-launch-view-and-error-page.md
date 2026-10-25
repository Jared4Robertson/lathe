---
id: LA-DSK-C18
kind: component
title: Launch view and error page
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/launch.ts
links:
  satisfies: [LA-DSK-UC05-R05, LA-DSK-UC05-R10, LA-DSK-UC05-R11, LA-DSK-DR14]
  depends_on: [LA-DSK-C01, LA-DSK-C19]
---
The models of the shell's own pages: the launch view and the error page (`static/launch.html`), drawn over a window's app page in a `WebContentsView` until the page's `data-specs` says ready or error, and the About window (`static/about.html`). The main process shows the launch view at once, in the last theme's shell color (`chrome.json`), lifts it when the specs answer, and shows the error page with the engine's message when they fail. `parseLocalAction` lets a page run only the buttons it shows.
