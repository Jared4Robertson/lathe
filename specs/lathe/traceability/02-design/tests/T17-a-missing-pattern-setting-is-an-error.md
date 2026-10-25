---
id: LA-TRC-T17
kind: test
title: A use case that lacks a field for one of its pattern's settings is an error
parent: LA-TRC
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC06-R06, LA-TRC-DR05]
---
Expects one `pattern-setting-missing` error, naming the `audit` setting, for a use case that gives `permission` but not `audit`.
