---
id: LA-CHK-T172
kind: test
title: Each domain counts its own tests by state; a test with no state is automated
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-proof.test.ts
links:
  proves: [LA-CHK-UC16-R02, LA-CHK-DR101]
---
Expects 2 automated (one with no state, one `Automated`), 1 manual and 2 planned (`planned` and `Planned`) in one domain, 1 automated in another, zero in a domain with no tests, and every test counted once.
