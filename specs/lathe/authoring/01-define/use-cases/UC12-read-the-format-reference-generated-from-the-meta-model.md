---
id: LA-AUT-UC12
kind: use_case
title: Read the format reference generated from the meta-model
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-CHK-DR24, LA-CHK-DR25, LA-AUT-DR58, LA-CHK-DR26, LA-AUT-DR59, LA-AUT-DR60, LA-AUT-DR61, LA-AUT-DR62]
---
The owner, or an agent, reads how every kind, relation, folder and check works without opening the CSVs or the SQL: `lathe format` writes the reference from the meta-model and the check files' header comments, after the product's extensions and with its own checks, and the app reads the same reference from `GET /api/format`. FORMAT.md keeps only the concepts, so a new kind or check needs no edit to it, and the `undocumented` check reports anything the reference would leave blank.
