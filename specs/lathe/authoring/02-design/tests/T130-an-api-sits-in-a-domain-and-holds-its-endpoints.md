---
id: LA-AUT-T130
kind: test
title: An API sits in a domain and holds its endpoints and the interaction requirements they share
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC18-R01, LA-AUT-DR81]
---
Loads a domain with an API holding an endpoint and a shared interaction requirement, and expects the `api` kind, `endpoint` widened to sit in an API, the two kinds an API may hold, and no errors.
