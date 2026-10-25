---
id: LA-CHK-C30
kind: component
title: Test file facts
parent: LA-CHK-LAY03
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC08-R01, LA-CHK-DR30]
---
`gatherFileFacts` in the workspace loader: for each test with a `run_by` file, records whether the file exists, whether it names the test's ID (or, for a test with a `key`, whether it contains the key), and in the `file_mentions` table which of the test's link targets it names, each matched as a whole ID.
