---
id: LA-TRC-T05
kind: test
title: Only automated and manual tests prove; a planned test makes an obligation planned
parent: LA-TRC
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-TRC-UC02-R03, LA-TRC-DR02]
---
Loads a fixture with a test with no state, a manual test and a planned test, and expects only the first two to prove, the planned one to count as planned, and the `unproved` warning to say so.
