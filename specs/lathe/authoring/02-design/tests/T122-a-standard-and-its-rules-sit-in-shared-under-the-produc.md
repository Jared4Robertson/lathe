---
id: LA-AUT-T122
kind: test
title: A standard and its rules sit in Shared under the product, and components and tests meet a rule
parent: LA-AUT
test_type: unit
run_by: lathe/test/standards.test.ts
links:
  proves: [LA-AUT-UC16-R01]
  meets: [LA-STD-CODE-R03]
---
Loads the `standards` fixture and expects the `standard` and `standard_rule` kinds in Shared right after the pattern rule, not obligations, the two `meets` rows labeled Meets and Met by with no role, `relation-not-allowed` for a requirement that meets a rule, and `dangling-link` for a rule that does not exist.
