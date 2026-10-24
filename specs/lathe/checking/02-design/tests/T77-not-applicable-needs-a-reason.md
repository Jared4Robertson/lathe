---
id: LA-CHK-T77
kind: test
title: "\"Not applicable:\" with a reason, in any letter case, counts as given; without a reason it does not"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R06, LA-CHK-DR42]
---
Expects `NOT APPLICABLE: it only reads` to count as given, `not applicable:` alone to be reported as having no reason, and a well-formed fixture to have no missing settings.
