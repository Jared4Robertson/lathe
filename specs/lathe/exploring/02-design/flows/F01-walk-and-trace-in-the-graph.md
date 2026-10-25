---
id: LA-EXP-F01
kind: flow
title: Walk a domain in the graph and trace a requirement
parent: LA-EXP
links:
  uses: [LA-EXP-V04, LA-EXP-V03, LA-PLT-E01]
  fulfills: [LA-TRC-UC10-R01]
  carries_out: [LA-EXP-UC03, LA-TRC-UC10, LA-EXP-UC04]
---
1. The reader opens a domain in the Graph view and sees it framed in the one map, its children grouped by kind, such as "Use cases (5)".
2. They click a group, then from node to node, to walk the model, the camera gliding to each while nothing in the map moves, with the breadcrumb trail showing the way back.
3. At a requirement or domain rule they switch on trace mode and see only its chain: what fulfills it, the components that satisfy it, the tests that prove it and their files.
4. They open any node's record page to read it in full.
