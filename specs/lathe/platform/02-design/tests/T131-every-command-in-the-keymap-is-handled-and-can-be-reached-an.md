---
id: LA-PLT-T131
kind: test
title: Every command in the keymap is handled and can be reached, and every command a control names is in the keymap
parent: LA-PLT
test_type: unit
run_by: app/test/commands-and-icons-used.test.ts
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Reads `app/src` and expects every keymap command that is not local to a component or left to the browser to be registered with `useCommand` (so the command palette lists it), every local or browser command to have keys, and every command a button, tooltip or run names to be in the keymap.
