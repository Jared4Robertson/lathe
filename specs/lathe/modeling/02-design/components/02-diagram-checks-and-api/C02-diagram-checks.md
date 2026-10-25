---
id: LA-MOD-C02
kind: component
title: Diagram checks
parent: LA-MOD-LAY02
component_type: sql check
file: lathe/diagrams/checks.sql
links:
  satisfies: [LA-MOD-DR02, LA-MOD-DR03, LA-MOD-DR04, LA-MOD-DR05, LA-MOD-DR13, LA-MOD-DR14, LA-MOD-DR15, LA-MOD-UC02-R02]
---
One DuckDB script that collects every diagram problem into a `problems` view and fails with all of them listed, or prints "All checks passed".
