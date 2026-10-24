---
id: LA-CHK-T140
kind: test
title: An unknown parent is reported once, as unknown-parent only
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC14-R08, LA-CHK-DR82]
---
Expects only `unknown-parent` for a use case under a parent that does not exist, and exactly four errors in the cascade fixture.
