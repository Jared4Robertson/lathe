---
id: LA-PLT-C17
kind: component
title: Shortcut hints on page controls
parent: LA-PLT-LAY04
component_type: react component
file: app/src/views/FocusPage.tsx
links:
  satisfies: [LA-PLT-UC05-R01, LA-PLT-UC05-R03]
  depends_on: [LA-PLT-C14]
---
The view toggles, the side bar toggles and the full-screen buttons (and, in the graph and the side bar, the depth buttons, trace switch and hide button) show their keys, for the current platform, through `Tooltip`.
