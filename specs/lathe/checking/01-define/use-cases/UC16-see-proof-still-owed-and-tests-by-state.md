---
id: LA-CHK-UC16
kind: use_case
title: See proof still owed and each domain's tests by state
parent: LA-CHK-CAP02
actor: Owner, Agent
links:
  applies: [LA-CHK-DR100, LA-CHK-DR101, LA-CHK-DR102]
---
The owner, or an agent, runs `lathe check` or reads the workspace's coverage and learns how much proof is still owed by tests not written yet, including for obligations another test already proves, and how many tests each domain has by state: automated, manual and planned, as S2's test-coverage table counts them.
