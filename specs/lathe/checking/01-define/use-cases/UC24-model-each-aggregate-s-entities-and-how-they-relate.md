---
id: LA-CHK-UC24
kind: use_case
title: Model each aggregate's entities and how they relate
parent: LA-CHK-CAP03
actor: Owner, Agent
links:
  applies: [LA-CHK-DR180, LA-CHK-DR181, LA-CHK-DR182, LA-CHK-DR183, LA-CHK-DR184, LA-CHK-DR185, LA-CHK-DR186, LA-CHK-DR187, LA-CHK-DR370]
---
The owner, or an agent, writes each aggregate's records as entities: one root and its child parts, each with a Fields table, linked by `has_one`, `has_many` and `refers_to`, and puts a rule that holds across aggregates under the domain, naming with `involves` the aggregates it ties together. `lathe check` reports what keeps the ERDs from being drawn, and the app reads each entity's fields to draw a domain's ERD at aggregate level and each aggregate's own ERD.
