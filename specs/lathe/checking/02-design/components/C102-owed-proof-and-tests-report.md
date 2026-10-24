---
id: LA-CHK-C102
kind: component
title: Owed proof and tests in the coverage report
parent: LA-CHK
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-CHK-UC16-R03]
  depends_on: [LA-CHK-C24]
---
The coverage part of `lathe check`'s report adds `; N/T with a planned test` to an obligation line where `planned_any` differs from `planned`, and prints a `<domain> tests: A automated, M manual, P planned` line for each domain.
