---
id: LA-AUT-T09
kind: test
title: A link whose relation is unknown or not allowed for its kinds is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-DR06]
---
Loads a view with a disallowed `applies` link and an unknown relation and expects one error of each.
