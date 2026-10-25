---
id: LA-AUT-T88
kind: test
title: A domain event sits under an aggregate and links by raised_by and reacts_to
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC12-R01, LA-AUT-DR66]
---
Expects the `domain_event` kind's stage, folder, parent kind and no required fields, the `raised_by` and three `reacts_to` rules with their labels, a `reacts_to` link from an aggregate, and relation-not-allowed for one from a domain rule.
