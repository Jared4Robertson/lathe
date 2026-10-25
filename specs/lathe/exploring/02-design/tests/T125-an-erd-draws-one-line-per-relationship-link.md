---
id: LA-EXP-T125
kind: test
title: An ERD draws exactly one line per relationship link
parent: LA-EXP
test_type: domain_rule
run_by: app/test/model.test.tsx
links:
  proves: [LA-EXP-DR37]
---
Builds every aggregate's ERD in a domain and expects their lines together to be exactly the domain's entity relationship links, each once, and the domain's ERD to draw one line per aggregate pair and direction, standing for every refers_to link that crosses aggregates.
