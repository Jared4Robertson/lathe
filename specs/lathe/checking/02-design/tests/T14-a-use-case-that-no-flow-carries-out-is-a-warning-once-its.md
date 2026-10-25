---
id: LA-CHK-T14
kind: test
title: A use case that no flow carries out is a warning, once its domain has flows
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R02, LA-CHK-DR07]
---
Loads a domain with a flow that carries out one use case and a flow that only fulfills another's requirement, and a second domain with no flows; expects `use-case-without-flow` on the second use case only.
