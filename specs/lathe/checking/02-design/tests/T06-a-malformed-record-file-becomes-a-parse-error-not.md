---
id: LA-CHK-T06
kind: test
title: A malformed record file becomes a parse error, not a crash
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC01-R05]
---
Loads a fixture containing a record file with broken YAML and expects a `parse-error` naming its path, with the other records still loaded.
