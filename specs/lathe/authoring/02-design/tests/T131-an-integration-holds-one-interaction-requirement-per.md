---
id: LA-AUT-T131
kind: test
title: An integration holds one interaction requirement per exchange and may name its system, and an interaction requirement may sit under the domain
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC18-R02, LA-AUT-UC18-R03, LA-AUT-DR82]
---
Expects the `integration` kind with its `system` field kept, an exchange under it, an interaction requirement directly under the domain, all four counted as the domain's interaction requirements, and no parent errors.
