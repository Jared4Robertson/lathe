---
id: LA-AUT-T27
kind: test
title: A record under a capability belongs to the capability's domain and counts in its coverage
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC05-R02]
---
Expects the capability and the records under it to carry the capability's domain, the pattern to carry no domain, and the requirements under capability use cases to be counted in the domain's coverage.
