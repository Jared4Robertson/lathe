---
id: LA-TRC-C18
kind: component
title: Proof not in file check
parent: LA-TRC-LAY04
component_type: sql check
file: lathe/checks/40-proof-not-in-file.sql
links:
  satisfies: [LA-TRC-UC05-R01, LA-TRC-UC05-R02, LA-TRC-UC05-R05, LA-TRC-DR11, LA-TRC-DR12, LA-TRC-DR14]
---
The `proof-not-in-file` check: for an automated test without a `key` whose file does not name its own ID, one row per `proof`-role link target, taken from the meta-model's relations, that the `file_mentions` table does not list. A `supports` link has no role, so it is never read here; a test with a `key_file` is judged by the key file.
