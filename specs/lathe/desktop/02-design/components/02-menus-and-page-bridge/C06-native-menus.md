---
id: LA-DSK-C06
kind: component
title: Native menus
parent: LA-DSK-LAY02
component_type: module
file: desktop/src/menu.ts
links:
  satisfies: [LA-DSK-UC03-R01, LA-DSK-UC03-R04, LA-DSK-UC01-R03, LA-DSK-UC05-R02, LA-DSK-UC05-R05, LA-DSK-UC05-R06, LA-DSK-UC05-R08]
  depends_on: [LA-DSK-C07, LA-DSK-C17]
---
The menu template: the app menu on a Mac with About Lathe and Settings… (CmdOrCtrl+,, which opens `/settings/appearance` through the `openAppearance` command), File with Open Product Folder… (CmdOrCtrl+O), Open Recent, Open Records In (the editor) and Close Window, the Edit role menu, View with the app commands, Tabs (next, previous, keep and close) and the window roles, the Window role menu, and Help with Record Format and Keyboard Shortcuts (and About Lathe off a Mac, with Settings in File). App command items have no accelerator, except Show Next Tab and Show Previous Tab, which own Ctrl+Tab and Ctrl+Shift+Tab, since a web page never receives them.
