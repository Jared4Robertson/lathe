---
id: LA-CHK-T700
kind: test
title: A config with an unknown setting is refused
parent: LA-CHK
test_type: unit
run_by: lathe/test/config.test.ts
links:
  proves: [LA-CHK-UC06-R02]
---
Expects a config that names a setting Lathe does not know, such as `diagrams`, to be refused by `loadConfig` and by `loadWorkspace`, with a message naming that setting.
