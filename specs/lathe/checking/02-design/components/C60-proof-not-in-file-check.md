---
id: LA-CHK-C60
kind: component
title: "Proof not in file check"
parent: LA-CHK
component_type: sql check
file: lathe/checks/40-proof-not-in-file.sql
links:
  satisfies: [LA-CHK-UC12-R01, LA-CHK-UC12-R02, LA-CHK-UC12-R05, LA-CHK-DR60, LA-CHK-DR61, LA-CHK-DR63]
---
The `proof-not-in-file` check: for an automated test without a `key` whose file does not name its own ID, one row per `proof`-role link target, taken from the meta-model's relations, that the `file_mentions` table does not list.
