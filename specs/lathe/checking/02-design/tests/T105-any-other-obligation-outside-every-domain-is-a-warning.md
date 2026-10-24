---
id: LA-CHK-T105
kind: test
title: Any other obligation outside every domain is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R08, LA-CHK-DR53]
---
An extension lets a domain rule sit under the product; expects exactly one `obligation-outside-domain` warning, on that rule.
