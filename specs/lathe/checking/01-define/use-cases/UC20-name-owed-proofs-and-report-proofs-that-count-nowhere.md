---
id: LA-CHK-UC20
kind: use_case
title: Name owed proofs and report proofs that count nowhere
parent: LA-CHK-CAP02
actor: Owner, Agent
links:
  applies: [LA-CHK-DR140, LA-CHK-DR141, LA-CHK-DR142, LA-CHK-DR143, LA-CHK-DR144]
---
The owner, or an agent, runs `lathe check` and reads, by ID, each proved obligation that a planned test still owes a proof of, as S2 lists the pattern proofs still needed; each test whose proof counts in no domain's coverage, with the reason for each target; and each manual test whose `run_by` file never mentions it.
