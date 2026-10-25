---
id: LA-TRC-T108
kind: test
title: The planned bar says how many more obligations, already proved, still have a planned test
parent: LA-TRC
test_type: unit
run_by: app/test/owed-proof.test.tsx
links:
  proves: [LA-TRC-UC13-R01, LA-TRC-DR36]
---
Expects `1 more planned`, with its hover text, on a domain rule's planned bar where `planned_any` is 1 and `planned` 0, on the product and domain pages, and nothing where the two are equal.
