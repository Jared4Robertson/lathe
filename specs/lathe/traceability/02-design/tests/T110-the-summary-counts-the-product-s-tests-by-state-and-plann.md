---
id: LA-TRC-T110
kind: test
title: The summary counts the product's tests by state, and planned beside proof
parent: LA-TRC
test_type: unit
run_by: app/test/owed-proof.test.tsx
links:
  proves: [LA-TRC-UC13-R03, LA-TRC-DR36]
---
Expects the Summary's Tests row to total its domains and its Planned row to add `; 1 more planned beside proof`, with the proved count unchanged.
