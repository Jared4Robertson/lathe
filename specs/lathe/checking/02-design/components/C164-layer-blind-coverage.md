---
id: LA-CHK-C164
kind: component
title: Layer-blind coverage
parent: LA-CHK
component_type: engine module
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC22-R04, LA-CHK-UC22-R05, LA-CHK-DR167, LA-CHK-DR168]
---
The coverage queries read a design link's source domain from `records.domain`, never from its parent, so a component in a layer designs and builds in its domain, including the pattern rules that domain owes.
