---
id: LA-CHK-C31
kind: component
title: Test proof check
parent: LA-CHK-LAY05
component_type: sql check
file: lathe/checks/14-test-file-missing-id.sql
links:
  satisfies: [LA-CHK-UC08-R01, LA-CHK-UC12-R03, LA-CHK-UC12-R04, LA-CHK-UC12-R05, LA-CHK-DR62, LA-CHK-UC27-R01, LA-CHK-DR204]
---
The `test-file-missing-id` check: an automated test with a `key` whose file does not contain the key, or an automated test that proves nothing (no `proof`-role link, taken from the meta-model's relations) whose file does not name its ID, unless it `supports` a record. A test with a `key_file` is judged by that file, and is left to `test-file-missing` when the key file is missing. A test that proves records but whose file names some of them is `proof-not-in-file` instead.
