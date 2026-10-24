---
id: LA-CHK-T76
kind: test
title: "A use case that lacks a field for one of its pattern's settings is an error"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R06, LA-CHK-DR42]
---
Expects one `pattern-setting-missing` error, naming the `audit` setting, for a use case that gives `permission` but not `audit`.
