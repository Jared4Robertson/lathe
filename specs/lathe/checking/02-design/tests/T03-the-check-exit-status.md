---
id: LA-CHK-T03
kind: test
title: The check exits 1 on any error and 0 otherwise, whatever the warnings
parent: LA-CHK
test_type: acceptance
run_by: lathe/test/cli.test.ts
links:
  proves: [LA-CHK-UC01-R02]
---
Runs `lathe check` on fixtures with errors (status 1), with no problems (status 0) and with only warnings (status 0).
