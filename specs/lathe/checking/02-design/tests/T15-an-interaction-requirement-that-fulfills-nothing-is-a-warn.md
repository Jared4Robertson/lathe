---
id: LA-CHK-T15
kind: test
title: An interaction requirement that fulfills nothing is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R03]
---
Loads a view with two interaction requirements, one with a `fulfills` link, and expects the warning on the other.
