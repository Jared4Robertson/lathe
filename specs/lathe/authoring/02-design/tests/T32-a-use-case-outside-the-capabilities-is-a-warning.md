---
id: LA-AUT-T32
kind: test
title: A use case directly under a domain that has capabilities is a warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC06-R04, LA-AUT-DR16]
---
Expects one `use-case-outside-capability` warning for the use case under a domain with capabilities, and none for the use case under a domain without any.
