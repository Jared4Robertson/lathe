---
id: LA-MOD-T10
kind: test
title: Loading a diagram reports every problem, not just the first
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R02]
---
Loads a diagram that breaks three rules and expects the check message to count and list all three, with the terms and links still returned.
