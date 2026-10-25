---
id: LA-AUT-T25
kind: test
title: Capabilities, patterns and the follows relation are in the meta-model
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC05-R01, LA-AUT-UC05-R05]
---
Loads a workspace and expects the `capability` and `pattern` kinds with their parents and required fields (none for `pattern`), `use_case`, `flow` and `test` allowed under a domain or a capability, and the `follows` rules from use case and from domain to pattern.
