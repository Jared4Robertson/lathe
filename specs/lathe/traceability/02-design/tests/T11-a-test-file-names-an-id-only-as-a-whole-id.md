---
id: LA-TRC-T11
kind: test
title: A test file names an ID only as a whole ID
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-DR04]
---
Loads a test that proves `PX-D-DR03` while its file names only `PX-D-DR030` and `PX-D-DR03-R01`, and expects a `proof-not-in-file` error.
