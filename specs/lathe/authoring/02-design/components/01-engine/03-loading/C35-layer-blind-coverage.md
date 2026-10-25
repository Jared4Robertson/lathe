---
id: LA-AUT-C35
kind: component
title: Layer-blind coverage
parent: LA-AUT-LAY04
component_type: engine module
file: lathe/src/coverage.ts
links:
  satisfies: [LA-AUT-UC09-R04, LA-AUT-UC09-R05, LA-AUT-DR47, LA-AUT-DR48]
---
The coverage queries read a design link's source domain from `records.domain`, never from its parent, so a component in a layer designs and builds in its domain, including the pattern rules that domain owes.
