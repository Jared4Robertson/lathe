---
id: LA-PLT-T126
kind: test
title: The app menu has About and Settings, File chooses the editor, and View has the record tabs
parent: LA-PLT
test_type: unit
run_by: desktop/test/commands.test.ts
links:
  proves: [LA-EXP-UC10-R08, LA-PLT-UC15-R05, LA-PLT-UC15-R06, LA-AUT-UC15-R02]
---
Checks About Lathe and Settings… (Cmd+,) in the app menu on macOS and in File and Help elsewhere, with no Check for Updates; File › Open Records In with the current editor checked; and View › Tabs, with Ctrl+Tab and Ctrl+Shift+Tab owned by the menu and every tab command sent by ID.
