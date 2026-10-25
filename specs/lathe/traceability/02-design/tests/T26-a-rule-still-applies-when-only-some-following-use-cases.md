---
id: LA-TRC-T26
kind: test
title: A rule still applies when only some following use cases mark its setting Not applicable
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R04, LA-TRC-DR09]
---
One following use case marks the setting Not applicable and another gives it a value; expects both rules' `proves` gaps in that domain.
