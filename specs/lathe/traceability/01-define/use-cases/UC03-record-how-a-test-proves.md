---
id: LA-TRC-UC03
kind: use_case
title: Record how a test proves its obligations
parent: LA-TRC-CAP02
actor: Owner, Agent
links:
  applies: [LA-TRC-DR04]
---
A person writes a `test` record for each test that proves a requirement, domain rule or other obligation, and says how it runs with `state`:

1. An **automated** test (the default) names the file that runs it in `run_by`. The file names the test's own ID or, as a real product often does, every ID it proves, so no separate test ID is needed in code. A test whose code names no ID gives a `key` the file must contain instead.
2. A **manual** test describes its procedure in its body.
3. A **planned** test is written before the test exists, to show what will prove an obligation.

`lathe check` reports a test whose state, `run_by` or file does not fit.
