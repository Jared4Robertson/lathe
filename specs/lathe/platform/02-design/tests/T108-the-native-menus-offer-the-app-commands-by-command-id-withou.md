---
id: LA-PLT-T108
kind: test
title: The native menus offer the app commands, by command ID, without taking any key
parent: LA-PLT
test_type: unit
run_by: desktop/test/commands.test.ts
links:
  proves: [LA-PLT-UC12-R01, LA-PLT-UC12-R04, LA-PLT-UC10-R01, LA-PLT-UC10-R03]
---
Builds the menu template for a Mac and elsewhere and checks its menus and items, that Open Recent opens the folder chosen, that every app command item sends its ID and has no accelerator, and that each command and binding is one in the app's keymap (`app/src/shell/keymap.ts`), pressed as the keymap reads it.
