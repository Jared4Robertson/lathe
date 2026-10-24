---
id: LA-CHK-UC14
kind: use_case
title: Find structural gaps and read each mistake once
parent: LA-CHK-CAP03
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR80, LA-CHK-DR81, LA-CHK-DR82, LA-CHK-DR83]
---
Jared, or an agent, runs `lathe check` on a product whose stages are written by different people at different times, and learns where they do not join up: a domain rule no use case relies on, a use case no flow carries out, an interaction requirement that carries out nothing, a test whose type does not suit what it proves. A product's extension can restate one of Lathe's relation rules in its own words without breaking. And when one record is wrong, for example a rule test given its rule's ID, the check says so once instead of in sixteen messages.
