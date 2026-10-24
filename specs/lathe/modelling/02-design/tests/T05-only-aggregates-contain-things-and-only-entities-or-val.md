---
id: LA-MOD-T05
kind: test
title: Only aggregates contain things, and only entities or value objects
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR04]
---
Loads a diagram in which an entity contains something and an aggregate contains a domain event, and expects both reported as bad containment.
