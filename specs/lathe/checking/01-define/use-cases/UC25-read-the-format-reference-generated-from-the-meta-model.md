---
id: LA-CHK-UC25
kind: use_case
title: Read the format reference generated from the meta-model
parent: LA-CHK-CAP03
actor: Owner, Agent
links:
  applies: [LA-CHK-DR190, LA-CHK-DR191, LA-CHK-DR192, LA-CHK-DR193, LA-CHK-DR194, LA-CHK-DR195, LA-CHK-DR196, LA-CHK-DR197]
---
The owner, or an agent, reads how every kind, relation, folder and check works without opening the CSVs or the SQL: `lathe format` writes the reference from the meta-model and the check files' header comments, after the product's extensions and with its own checks, and the app reads the same reference from `GET /api/format`. FORMAT.md keeps only the concepts, so a new kind or check needs no edit to it, and the `undocumented` check reports anything the reference would leave blank.
