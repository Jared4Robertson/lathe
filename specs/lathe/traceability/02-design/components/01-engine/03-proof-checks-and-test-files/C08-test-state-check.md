---
id: LA-TRC-C08
kind: component
title: Test state check
parent: LA-TRC-LAY04
component_type: sql check
file: lathe/checks/26-bad-test-state.sql
links:
  satisfies: [LA-TRC-UC03-R02]
---
The `bad-test-state` check: a test whose `state` is not `automated`, `manual` or `planned`.
