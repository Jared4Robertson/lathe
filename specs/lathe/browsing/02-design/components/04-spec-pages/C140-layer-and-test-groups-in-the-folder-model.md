---
id: LA-BRW-C140
kind: component
title: Layer and test groups in the folder model
parent: LA-BRW-LAY04
component_type: module
file: app/src/specs/folders.ts
links:
  satisfies: [LA-BRW-UC110-R01, LA-BRW-UC110-R02, LA-BRW-UC110-R08, LA-BRW-DR141, LA-BRW-DR142, LA-BRW-DR143, LA-BRW-DR144, LA-BRW-DR145, LA-BRW-DR146]
  depends_on: [LA-BRW-C130]
---
Gives each folder its groups: Technical specification by layer, each sub-layer a group within its layer, and Test plan by family and what each test proves (computed from its parent, `test_type`, `proves` and `supports` links, with no group level when only one group has tests), and finds the groups on a record's nav branch, through every layer above it.
