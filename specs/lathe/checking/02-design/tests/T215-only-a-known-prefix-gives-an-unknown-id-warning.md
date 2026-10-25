---
id: LA-CHK-T215
kind: test
title: Only a token with a known prefix that is not a record is an unknown-ID warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-CHK-UC18-R04, LA-CHK-DR123]
---
Expects no warning for a token with no known prefix or one in code, and exactly the two warnings for missing IDs with configured prefixes.
