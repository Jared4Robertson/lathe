---
id: LA-TRC-T23
kind: test
title: Only the domain's own components and tests design and prove a pattern rule there
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R03, LA-TRC-DR08]
---
A component and a test in one domain cover both rules; expects other following domains to count no proof from them. Design per domain, asked only when a product makes pattern rules full obligations, is tested by LA-TRC-T58.
