---
id: LA-CHK-C33
kind: component
title: Test run_by checks
parent: LA-CHK-LAY05
component_type: sql check
file: lathe/checks/27-test-run-by-missing.sql
links:
  satisfies: [LA-CHK-UC08-R03, LA-CHK-UC27-R02, LA-CHK-DR206]
  depends_on: [LA-CHK-C03]
---
The `test-run-by-missing` check: an automated test with no `run_by`. Together with `test-file-missing` (`lathe/checks/13-test-file-missing.sql`), which checks that any test's named file exists whatever its state, and that a test's `key_file` is a file under the product root.
