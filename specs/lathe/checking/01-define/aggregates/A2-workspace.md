---
id: LA-CHK-A2
kind: aggregate
title: Workspace
parent: LA-CHK
links:
  relates_to: [LA-CHK-A1, LA-MOD-A2, LA-CHK-A3]
---
The result of one load: the kinds, relation rules, records, links, problems and coverage, in the shape of `Workspace` in `lathe/src/types.ts`. A **problem** has a severity (error or warning), the check that found it, the record it is about (or none) and a message. **Coverage** is per domain: requirements and domain rules, how many are designed (a component satisfies them), how many are built (a component whose file exists satisfies them), how many are proved (a test proves them), and the gaps.
