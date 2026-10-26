---
id: LA-AUT-T124
kind: test
title: A standard rule that nothing meets or cites is a standard-rule-unmet warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/standards.test.ts
links:
  proves: [LA-AUT-UC16-R03, LA-AUT-DR77]
  meets: [LA-STD-CODE-R03]
---
Expects `standard-rule-unmet` warnings for exactly the rules no record meets or cites, a citation from the rule itself, its own standard or another product not counting, each naming the `meets` link to add.
