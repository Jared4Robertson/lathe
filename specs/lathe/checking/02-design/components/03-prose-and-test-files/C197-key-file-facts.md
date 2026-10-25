---
id: LA-CHK-C197
kind: component
title: Key file facts
parent: LA-CHK-LAY03
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC27-R02, LA-CHK-DR205, LA-CHK-DR206]
---
`gatherFileFacts` reads a test's `key_file`: whether it sits under the root and exists, kept in `file_facts` as `key_file`, `key_file_inside` and `key_file_exists`. When it is named, `contains_id` and the test's `file_mentions` are read from the key file instead of `run_by`; a missing key file contains nothing.
