---
id: LA-TRC-T18
kind: test
title: '"Not applicable:" with a reason, in any letter case, counts as given; without a reason it does not'
parent: LA-TRC
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC05-R06, LA-TRC-DR05]
---
Expects `NOT APPLICABLE: it only reads` to count as given, `not applicable:` alone to be reported as having no reason, and a well-formed fixture to have no missing settings.
