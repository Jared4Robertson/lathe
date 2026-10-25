---
id: LA-AUT-T23
kind: test
title: An extension lets a domain rule sit under a domain
parent: LA-AUT
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-AUT-UC05-R01, LA-AUT-DR13]
---
Loads a product whose extension adds `domain` to `domain_rule`'s parent kinds and `source` to its required fields, and expects one `domain_rule` kind with both parents, no error for a rule under the domain, and a missing `source` reported on a rule under an aggregate.
