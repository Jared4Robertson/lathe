---
id: LA-CHK-T08
kind: test
title: A product's meta-model extension adds kinds and relations
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC06-R03]
---
Loads a fixture whose `metaExtensions` folder adds a `report` kind and a `summarizes` relation, and checks that a record using them loads with no errors.
