---
id: LA-CHK-T93
kind: test
title: Only the domain's own components and tests design and prove a pattern rule there
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R03, LA-CHK-DR51]
---
A component and a test in one domain cover both rules; expects other following domains to count no proof from them. Design per domain, asked only when a product makes pattern rules full obligations, is tested by LA-CHK-T228.
