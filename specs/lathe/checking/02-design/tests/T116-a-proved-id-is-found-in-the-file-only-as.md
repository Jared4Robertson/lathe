---
id: LA-CHK-T116
kind: test
title: "A proved ID is found in the file only as a whole ID"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R02, LA-CHK-DR30]
---
Loads a test that proves `CL-D-DR04` while its file names only `CL-D-DR040` and `CL-D-DR04-R01`, and expects a `proof-not-in-file` error for `CL-D-DR04`.
