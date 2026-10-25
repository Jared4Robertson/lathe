---
id: LA-AUT-T08
kind: test
title: A link to a record that does not exist is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-AUT-DR05]
---
Loads a use case that applies a missing rule and expects a `dangling-link` error.
