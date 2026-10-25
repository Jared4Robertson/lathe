---
id: LA-PLT-T02
kind: test
title: A product's meta-model extension adds kinds and relations
parent: LA-PLT
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-PLT-UC02-R03]
---
Loads a fixture whose `metaExtensions` folder adds a `report` kind and a `summarizes` relation, and checks that a record using them loads with no errors.
