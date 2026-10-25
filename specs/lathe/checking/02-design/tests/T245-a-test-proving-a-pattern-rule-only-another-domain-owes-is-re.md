---
id: LA-CHK-T245
kind: test
title: A test proving a pattern rule only another domain owes is reported; one in a domain that follows the pattern itself is not
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-UC20-R02, LA-CHK-DR142]
---
Expects `proof-counts-nowhere` on a test in one domain proving a rule only another domain owes, naming both domains, and none on a test in a domain that follows the pattern itself.
