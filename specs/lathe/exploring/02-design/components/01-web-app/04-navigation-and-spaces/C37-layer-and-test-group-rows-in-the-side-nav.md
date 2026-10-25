---
id: LA-EXP-C37
kind: component
title: Layer and test-group rows in the side nav
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/Nav.tsx
links:
  satisfies: [LA-EXP-UC09-R03, LA-EXP-DR23]
  implements: [LA-EXP-V01]
  depends_on: [LA-EXP-C36, LA-EXP-C33]
---
Draws a folder's groups as foldable rows with counts: a layer's row beside a link to its page, a test group's row a fold only, opened along the current page's branch.
