---
id: LA-TRC-C23
kind: component
title: Owed proof and tests in the coverage report
parent: LA-TRC-LAY02
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-TRC-UC06-R03]
  depends_on: [LA-TRC-C05]
---
The coverage part of `lathe check`'s report adds `; N/T with a planned test` to an obligation line where `planned_any` differs from `planned`, and prints a `<domain> tests: A automated, M manual, P planned` line for each domain.
