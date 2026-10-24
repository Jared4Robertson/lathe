---
id: LA-CHK-T70
kind: test
title: "Capabilities, patterns and the follows relation are in the meta-model"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R01, LA-CHK-UC10-R05]
---
Loads a workspace and expects the `capability` and `pattern` kinds with their parents and required fields, `use_case`, `flow` and `test` allowed under a domain or a capability, and the `follows` rule from use case to pattern.
