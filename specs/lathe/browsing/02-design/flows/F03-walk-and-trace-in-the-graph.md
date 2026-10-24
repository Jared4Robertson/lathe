---
id: LA-BRW-F03
kind: flow
title: Walk a domain in the graph and trace a requirement
parent: LA-BRW
links:
  uses: [LA-BRW-V20, LA-BRW-V04, LA-BRW-E01]
  fulfills: [LA-BRW-UC21-R01]
  carries_out: [LA-BRW-UC20, LA-BRW-UC21, LA-BRW-UC40]
---
1. Jared opens a domain in the Graph view and sees its children folded into groups by kind, such as "Use cases (5)".
2. He opens a group and clicks from node to node to walk the model, with the breadcrumb trail showing the way back.
3. At a requirement or domain rule he switches on trace mode and sees only its chain: what fulfills it, the components that satisfy it, the tests that prove it and their files.
4. He opens any node's record page to read it in full.
