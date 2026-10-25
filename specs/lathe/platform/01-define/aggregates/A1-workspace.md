---
id: LA-PLT-A1
kind: aggregate
title: Workspace
parent: LA-PLT
links:
  reacts_to: [LA-AUT-EV01, LA-AUT-EV03, LA-CHK-EV01]
  relates_to: [LA-AUT-A1, LA-CHK-A1]
---
The result of one load: the kinds, relation rules, records, links, problems and coverage, in the shape of `Workspace` in `lathe/src/types.ts`. A **problem** has a severity (error or warning), the check that found it, the record it is about (or none) and a message. **Coverage** is per domain and obligation kind: how many are designed (a `design` link targets them), how many are built (a component whose file exists designs them), how many are proved (an automated or manual test proves them), how many are only planned, and the gaps.
