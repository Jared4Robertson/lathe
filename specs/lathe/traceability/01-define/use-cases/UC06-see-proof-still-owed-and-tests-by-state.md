---
id: LA-TRC-UC06
kind: use_case
title: See proof still owed and each domain's tests by state
parent: LA-TRC-CAP01
actor: Owner, Agent
links:
  applies: [LA-TRC-DR16, LA-TRC-DR17, LA-TRC-DR18]
---
The owner, or an agent, runs `lathe check` or reads the workspace's coverage and learns how much proof is still owed by tests not written yet, including for obligations another test already proves, and how many tests each domain has by state: automated, manual and planned, as S2's test-coverage table counts them.
