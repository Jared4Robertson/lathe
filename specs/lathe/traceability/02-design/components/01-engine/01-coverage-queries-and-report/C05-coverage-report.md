---
id: LA-TRC-C05
kind: component
title: Coverage report
parent: LA-TRC-LAY02
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-TRC-UC02-R05]
  depends_on: [LA-TRC-C04]
---
The coverage part of `lathe check`'s report: one line per domain and obligation kind, such as `LA-CHK requirement: 21/21 designed, 21/21 built, 21/21 proved, 0/21 planned; 0 gaps`.
