---
id: LA-TRC-C35
kind: component
title: Key file facts
parent: LA-TRC-LAY04
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-TRC-UC03-R05, LA-TRC-DR30, LA-TRC-DR31]
---
`gatherFileFacts` reads a test's `key_file`: whether it sits under the root and exists, kept in `file_facts` as `key_file`, `key_file_inside` and `key_file_exists`. When it is named, `contains_id` and the test's `file_mentions` are read from the key file instead of `run_by`; a missing key file contains nothing.
