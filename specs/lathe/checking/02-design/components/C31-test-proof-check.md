---
id: LA-CHK-C31
kind: component
title: Test proof check
parent: LA-CHK
component_type: sql check
file: lathe/checks/14-test-file-missing-id.sql
links:
  satisfies: [LA-CHK-UC08-R01]
---
The `test-file-missing-id` check: an automated test whose file names neither its ID nor the target of one of its `proof`-role links, taken from the meta-model's relations.
