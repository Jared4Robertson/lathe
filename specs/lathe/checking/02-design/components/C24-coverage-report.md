---
id: LA-CHK-C24
kind: component
title: Coverage report
parent: LA-CHK
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-CHK-UC07-R05]
  depends_on: [LA-CHK-C23]
---
The coverage part of `lathe check`'s report: one line per domain and obligation kind, such as `LA-CHK requirement: 21/21 designed, 21/21 built, 21/21 proved, 0/21 planned; 0 gaps`.
