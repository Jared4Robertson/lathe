---
id: LA-CHK-T75
kind: test
title: "A use case directly under a domain that has capabilities is a warning"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R04, LA-CHK-DR41]
---
Expects one `use-case-outside-capability` warning for the use case under a domain with capabilities, and none for the use case under a domain without any.
