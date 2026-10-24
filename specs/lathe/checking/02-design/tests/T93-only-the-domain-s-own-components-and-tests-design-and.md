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
A component and a test in one domain cover both rules; expects another following domain to count only what its own component designs, and a third to count nothing.
