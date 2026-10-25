---
id: LA-TRC-T34
kind: test
title: Any other obligation outside every domain is a warning
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R08, LA-TRC-DR10]
---
An extension lets a domain rule sit under the product; expects exactly one `obligation-outside-domain` warning, on that rule.
