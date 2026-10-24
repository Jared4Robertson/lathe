---
id: LA-MOD-T15
kind: test
title: A new diagram gets headed, empty CSV files and one registry row
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC01-R02]
---
Creates a diagram whose title holds a comma and quotes, and expects header-only `terms.csv` and `links.csv`, one correctly quoted row added to `diagrams.csv`, and an empty diagram that passes its checks.
