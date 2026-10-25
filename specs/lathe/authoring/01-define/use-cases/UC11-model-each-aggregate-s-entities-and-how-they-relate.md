---
id: LA-AUT-UC11
kind: use_case
title: Model each aggregate's entities and how they relate
parent: LA-AUT-CAP03
actor: Owner, Agent
links:
  applies: [LA-AUT-DR50, LA-AUT-DR51, LA-AUT-DR52, LA-AUT-DR53, LA-AUT-DR54, LA-AUT-DR55, LA-AUT-DR56, LA-AUT-DR57]
---
The owner, or an agent, writes each aggregate's records as entities: one root and its child parts, each with a Fields table, linked by `has_one`, `has_many` and `refers_to`. `lathe check` reports what keeps the ERDs from being drawn, and the app reads each entity's fields to draw a domain's ERD at aggregate level and each aggregate's own ERD.
