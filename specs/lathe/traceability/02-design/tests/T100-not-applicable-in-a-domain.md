---
id: LA-TRC-T100
kind: test
title: A rule can be not applicable in one domain and owed in another
parent: LA-TRC
test_type: unit
run_by: app/test/patterns.test.tsx
links:
  proves: [LA-TRC-UC12-R02, LA-TRC-DR35]
---
Expects a rule naming a setting to be not applicable where every following use case marks it so, with the reasons, and owed where one gives a value.
