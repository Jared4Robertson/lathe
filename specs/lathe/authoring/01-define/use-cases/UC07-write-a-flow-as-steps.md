---
id: LA-AUT-UC07
kind: use_case
title: Write a flow as ordered steps and have them checked
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-AUT-DR24, LA-AUT-DR25, LA-AUT-DR26, LA-CHK-DR12]
---
The owner, or an agent, writes a flow as `flow_step` records, as S2 writes its flows as tables: each step in order, with what happens, the view, endpoint or component it goes through, and what it carries out. `lathe check` says when two steps share a place, when a step carries out something its flow does not, and when the flow still claims something none of its steps does, so traceability can be read per step.
