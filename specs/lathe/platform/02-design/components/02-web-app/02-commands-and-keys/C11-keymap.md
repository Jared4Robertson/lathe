---
id: LA-PLT-C11
kind: component
title: Keymap
parent: LA-PLT-LAY04
component_type: module
file: app/src/shell/keymap.ts
links:
  satisfies: [LA-PLT-UC04-R01, LA-PLT-UC04-R02, LA-PLT-UC04-R03, LA-PLT-UC04-R05, LA-PLT-UC04-R07, LA-PLT-DR04, LA-PLT-DR05, LA-PLT-DR06, LA-EXP-UC10-R04]
---
The one table of keyboard commands (id, title, group, default keys and, where they differ, the keys off a Mac, context), the platform modifier, chord and sequence matching, the typing guard, the reserved browser keys, the overrides from local storage, the duplicate check and how a binding is shown. It lists the tab commands: Ctrl+K then Enter keeps the tab (Alt+K then Enter off a Mac), Alt+Shift+W closes it, and Ctrl+Tab and Ctrl+Shift+Tab cycle.
