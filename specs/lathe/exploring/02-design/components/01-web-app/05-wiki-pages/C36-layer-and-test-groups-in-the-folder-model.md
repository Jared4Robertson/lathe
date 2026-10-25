---
id: LA-EXP-C36
kind: component
title: Layer and test groups in the folder model
parent: LA-EXP-LAY06
component_type: module
file: app/src/specs/folders.ts
links:
  satisfies: [LA-EXP-UC09-R01, LA-EXP-UC09-R02, LA-EXP-UC09-R08, LA-EXP-DR24, LA-EXP-DR25, LA-EXP-DR26, LA-EXP-DR27, LA-EXP-DR28, LA-EXP-DR29]
  depends_on: [LA-EXP-C32]
---
Gives each folder its groups: Technical specification by layer, each sub-layer a group within its layer, and Test plan by family and what each test proves (computed from its parent, `test_type`, `proves` and `supports` links, with no group level when only one group has tests), and finds the groups on a record's nav branch, through every layer above it.
