---
id: LA-TRC-C19
kind: component
title: Test key fact
parent: LA-TRC-LAY04
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-TRC-UC05-R03, LA-TRC-DR13]
---
`gatherFileFacts` in the workspace loader: for a test with a `key`, `contains_id` in `file_facts` says whether the file contains the key text exactly, in place of whether it names the test's ID.
