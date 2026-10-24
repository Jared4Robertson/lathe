---
id: LA-CHK-C61
kind: component
title: "Test key fact"
parent: LA-CHK
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC12-R03, LA-CHK-DR62]
---
`gatherFileFacts` in the workspace loader: for a test with a `key`, `contains_id` in `file_facts` says whether the file contains the key text exactly, in place of whether it names the test's ID.
