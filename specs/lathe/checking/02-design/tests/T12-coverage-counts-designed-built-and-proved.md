---
id: LA-CHK-T12
kind: test
title: Coverage counts designed, built and proved separately
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC02-R04, LA-CHK-DR07]
---
Loads a fixture where one requirement is satisfied by a component whose file exists, one by a component whose file is missing, and one by nothing, and expects designed 2, built 1 and proved 1, with built never above designed in any fixture.
