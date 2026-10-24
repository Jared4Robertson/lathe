---
id: LA-CHK-T73
kind: test
title: "An order that is not a whole number is an error"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R03, LA-CHK-DR40]
---
Expects a `capability-order` error for orders `first` and `2.5`, quoting each value.
