---
id: LA-DSK-T23
kind: test
title: The app menu has About and Settings, File chooses the editor, and View has the record tabs
parent: LA-DSK
test_type: unit
run_by: desktop/test/commands.test.ts
links:
  proves: [LA-DSK-UC05-R02, LA-DSK-UC05-R05, LA-DSK-UC05-R06, LA-DSK-UC05-R08]
---
Checks About Lathe and Settings… (Cmd+,) in the app menu on macOS and in File and Help elsewhere, with no Check for Updates; File › Open Records In with the current editor checked; and View › Tabs, with Ctrl+Tab and Ctrl+Shift+Tab owned by the menu and every tab command sent by ID.
