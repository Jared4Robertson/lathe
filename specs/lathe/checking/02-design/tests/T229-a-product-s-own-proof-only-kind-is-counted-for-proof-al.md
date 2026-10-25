---
id: LA-CHK-T229
kind: test
title: A product's own proof-only kind is counted for proof alone, and a kind that is not an obligation is not counted
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R04, LA-CHK-UC19-R05, LA-CHK-DR134, LA-CHK-DR135]
---
An extension kind with `obligation` `Proof` is proved by a test and satisfied by nothing; expects it designed, built and proved, with no warnings, and a `maybe` kind not counted at all.
