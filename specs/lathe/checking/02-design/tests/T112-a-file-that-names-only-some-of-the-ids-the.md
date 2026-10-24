---
id: LA-CHK-T112
kind: test
title: "A file that names only some of the IDs the test proves is an error for each one left out"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R02, LA-CHK-DR61]
---
Loads a test that proves two rules while its file names one, and expects one `proof-not-in-file` error, for the other.
