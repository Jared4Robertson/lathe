---
id: LA-TRC-T117
kind: test
title: A domain rule under its domain shows the aggregates it involves under "Involves", and each aggregate shows it under "Involved in"; an interaction requirement's Carries out is not repeated
parent: LA-TRC
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-TRC-UC14-R01]
---
Reads the `involves` row of the meta-model's relations, opens a domain rule under its domain that involves two aggregates and expects its Traceability to list them under Involves, the aggregate's to list the rule under Involved in, and an interaction requirement's Traceability to leave out the Carries out its own section shows.
