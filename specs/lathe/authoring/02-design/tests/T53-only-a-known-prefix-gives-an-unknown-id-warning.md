---
id: LA-AUT-T53
kind: test
title: Only a token with a known prefix that is not a record is an unknown-ID warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-AUT-UC07-R04, LA-AUT-DR30]
---
Expects no warning for a token with no known prefix or one in code, and exactly the two warnings for missing IDs with configured prefixes.
