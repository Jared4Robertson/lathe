---
id: LA-AUT-T30
kind: test
title: An order that is not a whole number is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC06-R03, LA-AUT-DR15]
---
Expects a `capability-order` error for orders `first` and `2.5`, quoting each value.
