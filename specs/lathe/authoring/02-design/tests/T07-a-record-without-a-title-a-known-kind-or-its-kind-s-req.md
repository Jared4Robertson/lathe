---
id: LA-AUT-T07
kind: test
title: A record without a title, a known kind or its kind's required fields is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-AUT-DR04]
---
Loads a record with an empty title, one with an unknown kind and a use case with no actor, and expects the matching errors.
