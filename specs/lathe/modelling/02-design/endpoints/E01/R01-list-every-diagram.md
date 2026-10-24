---
id: LA-MOD-E01-R01
kind: interaction_requirement
title: GET /api/diagrams lists every registered diagram
parent: LA-MOD-E01
links:
  fulfills: [LA-MOD-UC02-R01]
---
The response MUST be 200 with a JSON array of `{slug, title, description}`, one per row of `diagrams.csv` in registry order, and an empty array when there is no registry.
