---
id: LA-CHK-UC21
kind: use_case
title: Read each kind's folder from the meta-model
parent: LA-CHK-CAP03
actor: Owner, Agent
links:
  applies: [LA-CHK-DR150, LA-CHK-DR151, LA-CHK-DR152, LA-CHK-DR153]
---
The owner, or an agent, reads which folder each kind sits in, as S2 lays out a domain's specs (Define: Domain model, Use cases; Design: Interaction design, Technical specification, Test plan; and Shared for patterns), from `meta/sections.csv` and the `section` column of `kinds.csv`. A product can add a folder or move a kind into another with its extensions, and `lathe check` reports a kind whose folder is not listed or belongs to another stage.
