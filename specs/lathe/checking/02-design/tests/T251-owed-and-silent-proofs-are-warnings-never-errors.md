---
id: LA-CHK-T251
kind: test
title: Owed and silent proofs are warnings, never errors, and a workspace without them has none
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-DR144]
---
Expects all three checks to report only warnings in a workspace with no errors, and none in the `good` fixture.
