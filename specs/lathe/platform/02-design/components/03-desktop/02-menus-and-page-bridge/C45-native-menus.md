---
id: LA-PLT-C45
kind: component
title: Native menus
parent: LA-PLT-LAY10
component_type: module
file: desktop/src/menu.ts
links:
  satisfies: [LA-PLT-UC13-R01, LA-PLT-UC13-R04, LA-PLT-UC11-R03, LA-EXP-UC10-R08, LA-PLT-UC15-R05, LA-PLT-UC15-R06, LA-AUT-UC15-R02]
  depends_on: [LA-PLT-C46, LA-AUT-C68]
---
The menu template: the app menu on a Mac with About Lathe and Settings… (CmdOrCtrl+,, which opens `/settings/appearance` through the `openAppearance` command), File with Open Product Folder… (CmdOrCtrl+O), Open Recent, Open Records In (the editor) and Close Window, the Edit role menu, View with the app commands, Tabs (next, previous, keep and close) and the window roles, the Window role menu, and Help with Record Format and Keyboard Shortcuts (and About Lathe off a Mac, with Settings in File). App command items have no accelerator, except Show Next Tab and Show Previous Tab, which own Ctrl+Tab and Ctrl+Shift+Tab, since a web page never receives them.
