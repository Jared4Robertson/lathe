---
id: LA-EXP-C31
kind: component
title: Checks filtered by space
parent: LA-EXP-LAY05
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  satisfies: [LA-EXP-UC07-R07]
  implements: [LA-CHK-V01]
  depends_on: [LA-EXP-C27]
---
The Checks page reads `?product=` and shows only that product's problems, with a two-way filter between all products and the current space.
