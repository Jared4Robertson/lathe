---
id: LA-BRW-C61
kind: component
title: Command dispatcher, palette and shortcuts sheet
parent: LA-BRW-LAY02
component_type: react component
file: app/src/shell/commands.tsx
links:
  satisfies: [LA-BRW-UC51-R01, LA-BRW-UC51-R02, LA-BRW-UC51-R03, LA-BRW-UC51-R04, LA-BRW-UC51-R05, LA-BRW-UC51-R06, LA-BRW-DR61, LA-BRW-DR62, LA-BRW-UC120-R02, LA-BRW-UC120-R04]
  depends_on: [LA-BRW-C60]
---
One window key listener that matches presses against the keymap and runs the handler a mounted component registered for that command (so a command applies only while something on screen handles it), calling preventDefault only then; the waiting hint for sequences; the live region for announcements; and the command palette and shortcuts sheet dialogs.
