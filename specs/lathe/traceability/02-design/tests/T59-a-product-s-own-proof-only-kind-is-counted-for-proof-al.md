---
id: LA-TRC-T59
kind: test
title: A product's own proof-only kind is counted for proof alone, and a kind that is not an obligation is not counted
parent: LA-TRC
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-TRC-UC07-R04, LA-TRC-UC07-R05, LA-AUT-DR33, LA-TRC-DR22]
---
An extension kind with `obligation` `Proof` is proved by a test and satisfied by nothing; expects it designed, built and proved, with no warnings, and a `maybe` kind not counted at all.
