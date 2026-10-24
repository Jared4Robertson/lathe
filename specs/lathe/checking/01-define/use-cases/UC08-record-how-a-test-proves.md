---
id: LA-CHK-UC08
kind: use_case
title: Record how a test proves its obligations
parent: LA-CHK-CAP01
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR30]
---
A person writes a `test` record for each test that proves a requirement, domain rule or other obligation, and says how it runs with `state`:

1. An **automated** test (the default) names the file that runs it in `run_by`. The file names the test's own ID or, as S2 does, the ID of the rule it proves, so no separate test ID is needed in code.
2. A **manual** test describes its procedure in its body.
3. A **planned** test is written before the test exists, to show what will prove an obligation.

`lathe check` reports a test whose state, `run_by` or file does not fit.
