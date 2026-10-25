---
id: LA-BRW-C140
kind: component
title: Layer and test groups in the folder model
parent: LA-BRW
component_type: module
file: app/src/specs/folders.ts
links:
  satisfies: [LA-BRW-UC110-R01, LA-BRW-UC110-R02, LA-BRW-DR141, LA-BRW-DR142, LA-BRW-DR143, LA-BRW-DR144, LA-BRW-DR145, LA-BRW-DR146]
  depends_on: [LA-BRW-C130]
---
Gives each folder its groups: Technical specification by layer, Test plan by what each test proves (computed from `proves` links, the first group that applies, with no group level when only one group has tests), and finds the groups on a record's nav branch.
