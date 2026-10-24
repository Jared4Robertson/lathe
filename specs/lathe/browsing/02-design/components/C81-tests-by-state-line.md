---
id: LA-BRW-C81
kind: component
title: Tests by state line
parent: LA-BRW
component_type: react component
file: app/src/specs/ProductHealth.tsx
links:
  satisfies: [LA-BRW-UC70-R02, LA-BRW-DR80]
  depends_on: [LA-BRW-C30]
---
`testCounts` reads `Coverage.tests`, each state null when not reported, and `TestCountsLine` draws it under `CoverageBars` on the product's domain cards and the domain page, saying not yet measured for an unknown count.
