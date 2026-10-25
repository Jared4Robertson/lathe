---
id: LA-TRC-C34
kind: component
title: Manual test file silent check
parent: LA-TRC-LAY04
component_type: sql check
file: lathe/checks/55-manual-test-file-silent.sql
links:
  satisfies: [LA-TRC-UC08-R03, LA-TRC-DR27, LA-CHK-DR13]
---
The `manual-test-file-silent` warning: a manual test whose `run_by` file exists, from `file_facts` and `file_mentions`, where the file names neither the test's ID, its key, nor any target of its proof links.
