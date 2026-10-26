---
id: LA-TRC-T120
kind: test
title: A rule no follower meets shows as Waived here, with the value given, and the gaps leave it out
parent: LA-TRC
test_type: unit
run_by: app/test/groups-and-waivers.test.tsx
links:
  proves: [LA-TRC-UC12-R06, LA-TRC-DR39]
---
Expects a rule that applies when the record is a basket to apply where a use case gives " Basket " and to read "Waived here: record is Payment" on the domain page and the rule page of a domain that gives Payment, whose Traceability lists only the owing domain; a domain that follows the pattern itself and gives the value meets it.
