---
id: LA-CHK-C142
kind: component
title: Manual test file silent check
parent: LA-CHK-LAY05
component_type: sql check
file: lathe/checks/55-manual-test-file-silent.sql
links:
  satisfies: [LA-CHK-UC20-R03, LA-CHK-DR143, LA-CHK-DR144]
---
The `manual-test-file-silent` warning: a manual test whose `run_by` file exists, from `file_facts` and `file_mentions`, where the file names neither the test's ID, its key, nor any target of its proof links.
