---
id: LA-PLT-T18
kind: test
title: Bindings can be overridden in local storage, never onto a browser key
parent: LA-PLT
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-PLT-UC04-R05, LA-PLT-DR06]
---
Stores overrides, expects unknown commands and local keys ignored, a browser essential dropped, the new binding matched, and bad JSON ignored.
