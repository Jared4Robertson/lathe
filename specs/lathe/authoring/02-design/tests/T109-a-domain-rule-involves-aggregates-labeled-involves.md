---
id: LA-AUT-T109
kind: test
title: A domain rule involves aggregates, labeled "Involves" and "Involved in" with no role, and the record format says when
parent: LA-AUT
test_type: unit
run_by: lathe/test/domain-rule-involves.test.ts
links:
  proves: [LA-AUT-UC10-R01]
---
Expects the `involves` relation from domain rule to aggregate loaded from the meta-model with its labels and no role, the rule's links read from its front matter, and the domain rule's description and section 17 of the record format naming it and the check.
