---
id: LA-CHK-C31
kind: component
title: Test proof check
parent: LA-CHK
component_type: sql check
file: lathe/checks/14-test-file-missing-id.sql
links:
  satisfies: [LA-CHK-UC08-R01, LA-CHK-UC12-R03, LA-CHK-UC12-R04, LA-CHK-UC12-R05, LA-CHK-DR62]
---
The `test-file-missing-id` check: an automated test with a `key` whose file does not contain the key, or an automated test that proves nothing (no `proof`-role link, taken from the meta-model's relations) whose file does not name its ID. A test that proves records but whose file names some of them is `proof-not-in-file` instead.
