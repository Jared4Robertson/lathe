---
id: LA-TRC-T02
kind: test
title: Coverage counts designed, built and proved separately
parent: LA-TRC
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-TRC-UC01-R04, LA-TRC-DR01]
---
Loads a fixture where one requirement is satisfied by a component whose file exists, one by a component whose file is missing, and one by nothing, and expects designed 2, built 1 and proved 1, with built never above designed in any fixture.
