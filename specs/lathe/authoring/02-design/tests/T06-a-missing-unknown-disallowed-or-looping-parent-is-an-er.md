---
id: LA-AUT-T06
kind: test
title: A missing, unknown, disallowed or looping parent is an error, as is a product with a parent
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-DR03]
---
Loads records that break each parent rule and expects one error of the matching check against each.
