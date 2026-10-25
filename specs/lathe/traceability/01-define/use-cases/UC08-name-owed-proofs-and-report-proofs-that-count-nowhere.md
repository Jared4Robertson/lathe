---
id: LA-TRC-UC08
kind: use_case
title: Name owed proofs and report proofs that count nowhere
parent: LA-TRC-CAP01
actor: Owner, Agent
links:
  applies: [LA-TRC-DR24, LA-TRC-DR25, LA-TRC-DR26, LA-TRC-DR27, LA-CHK-DR13]
---
The owner, or an agent, runs `lathe check` and reads, by ID, each proved obligation that a planned test still owes a proof of, as S2 lists the pattern proofs still needed; each test whose proof counts in no domain's coverage, with the reason for each target; and each manual test whose `run_by` file never mentions it.
