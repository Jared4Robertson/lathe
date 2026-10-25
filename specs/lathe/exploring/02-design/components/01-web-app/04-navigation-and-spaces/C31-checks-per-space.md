---
id: LA-EXP-C31
kind: component
title: Checks per space
parent: LA-EXP-LAY05
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  satisfies: [LA-EXP-UC07-R07, LA-EXP-UC07-R10, LA-CHK-UC07-R01]
  implements: [LA-CHK-V01]
  depends_on: [LA-EXP-C27, LA-EXP-C65]
---
The Checks page at `/<product-id>/checks` reads the space's own index: its product's problems by check, then the problems of no product under Workspace. The products page beside it lists each product with its name and domain count only.
