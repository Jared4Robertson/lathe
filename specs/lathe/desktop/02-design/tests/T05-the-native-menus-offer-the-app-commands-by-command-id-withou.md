---
id: LA-DSK-T05
kind: test
title: The native menus offer the app commands, by command ID, without taking any key
parent: LA-DSK
test_type: unit
run_by: desktop/test/commands.test.ts
links:
  proves: [LA-DSK-UC03-R01, LA-DSK-UC03-R04, LA-DSK-UC01-R01, LA-DSK-UC01-R03]
---
Builds the menu template for a Mac and elsewhere and checks its menus and items, that Open Recent opens the folder chosen, that every app command item sends its ID and has no accelerator, and that each command and binding is one in the app's keymap (`app/src/shell/keymap.ts`), pressed as the keymap reads it.
