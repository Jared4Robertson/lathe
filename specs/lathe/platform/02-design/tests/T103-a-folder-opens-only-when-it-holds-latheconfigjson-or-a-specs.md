---
id: LA-PLT-T103
kind: test
title: A folder opens only when it holds lathe.config.json or a specs folder
parent: LA-PLT
test_type: unit
run_by: desktop/test/folders.test.ts
links:
  proves: [LA-PLT-DR26, LA-PLT-UC10-R02]
---
Builds folders with a config, with only `specs/`, with neither, with a broken config, and a plain file, and checks which open and what the refusals say; then checks the window title from two product records.
