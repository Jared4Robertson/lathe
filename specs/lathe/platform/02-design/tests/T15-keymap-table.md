---
id: LA-PLT-T15
kind: test
title: Every command has a title, and no binding clashes or takes a browser key
parent: LA-PLT
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-PLT-UC04-R01, LA-PLT-DR04, LA-PLT-DR06]
---
Checks every row of the keymap for an id, title and group, finds no duplicate binding on either platform and no reserved key, shows that the duplicate check catches a clash and a sequence prefix, and checks the VS Code defaults.
