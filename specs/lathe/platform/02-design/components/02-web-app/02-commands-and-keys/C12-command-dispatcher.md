---
id: LA-PLT-C12
kind: component
title: Command dispatcher, palette and shortcuts sheet
parent: LA-PLT-LAY04
component_type: react component
file: app/src/shell/commands.tsx
links:
  satisfies: [LA-PLT-UC04-R01, LA-PLT-UC04-R02, LA-PLT-UC04-R03, LA-PLT-UC04-R04, LA-PLT-UC04-R05, LA-PLT-UC04-R06, LA-PLT-DR05, LA-PLT-DR06, LA-PLT-UC10-R02, LA-PLT-UC10-R04]
  depends_on: [LA-PLT-C11]
---
One window key listener that matches presses against the keymap and runs the handler a mounted component registered for that command (so a command applies only while something on screen handles it), calling preventDefault only then; the waiting hint for sequences; the live region for announcements; and the command palette and shortcuts sheet dialogs.
