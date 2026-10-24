---
id: LA-CHK-C32
kind: component
title: Test state check
parent: LA-CHK
component_type: sql check
file: lathe/checks/26-bad-test-state.sql
links:
  satisfies: [LA-CHK-UC08-R02]
---
The `bad-test-state` check: a test whose `state` is not `automated`, `manual` or `planned`.
