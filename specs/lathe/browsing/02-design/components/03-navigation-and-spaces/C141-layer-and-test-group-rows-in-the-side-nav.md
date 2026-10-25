---
id: LA-BRW-C141
kind: component
title: Layer and test-group rows in the side nav
parent: LA-BRW-LAY03
component_type: react component
file: app/src/shell/Nav.tsx
links:
  satisfies: [LA-BRW-UC110-R03, LA-BRW-DR140]
  implements: [LA-BRW-V01]
  depends_on: [LA-BRW-C140, LA-BRW-C131]
---
Draws a folder's groups as foldable rows with counts: a layer's row beside a link to its page, a test group's row a fold only, opened along the current page's branch.
