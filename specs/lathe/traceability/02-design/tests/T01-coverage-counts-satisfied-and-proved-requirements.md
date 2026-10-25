---
id: LA-TRC-T01
kind: test
title: Coverage counts satisfied and proved requirements and lists the gaps
parent: LA-TRC
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-TRC-UC01-R01, LA-TRC-UC01-R02, LA-TRC-DR01]
---
Loads a fixture with known `satisfies` and `proves` links and expects the domain's coverage counts and gaps to match.
