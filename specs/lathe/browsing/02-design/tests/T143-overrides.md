---
id: LA-BRW-T143
kind: test
title: Bindings can be overridden in local storage, never onto a browser key
parent: LA-BRW
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-BRW-UC51-R05, LA-BRW-DR62]
---
Stores overrides, expects unknown commands and local keys ignored, a browser essential dropped, the new binding matched, and bad JSON ignored.
