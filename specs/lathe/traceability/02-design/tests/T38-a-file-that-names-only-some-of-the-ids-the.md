---
id: LA-TRC-T38
kind: test
title: A file that names only some of the IDs the test proves is an error for each one left out
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R02, LA-TRC-DR12]
---
Loads a test that proves two rules while its file names one, and expects one `proof-not-in-file` error, for the other.
