---
id: LA-BRW-C104
kind: component
title: Checks filtered by space
parent: LA-BRW
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  satisfies: [LA-BRW-UC90-R07]
  implements: [LA-BRW-V05]
  depends_on: [LA-BRW-C100]
---
The Checks page reads `?product=` and shows only that product's problems, with a two-way filter between all products and the current space.
