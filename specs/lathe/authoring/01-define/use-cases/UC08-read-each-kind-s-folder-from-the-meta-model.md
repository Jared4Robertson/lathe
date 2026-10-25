---
id: LA-AUT-UC08
kind: use_case
title: Read each kind's folder from the meta-model
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-AUT-DR36, LA-AUT-DR37, LA-AUT-DR38, LA-AUT-DR39]
---
The owner, or an agent, reads which folder each kind sits in, as a real product lays out a domain's specs in stage folders (Define: Domain model, Use cases; Design: Interaction design, Technical specification, Test plan; and Shared for patterns), from `meta/sections.csv` and the `section` column of `kinds.csv`. A product can add a folder or move a kind into another with its extensions, and `lathe check` reports a kind whose folder is not listed or belongs to another stage.
