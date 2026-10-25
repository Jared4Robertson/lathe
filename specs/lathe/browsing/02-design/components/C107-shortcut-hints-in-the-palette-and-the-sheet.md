---
id: LA-BRW-C107
kind: component
title: Shortcut hints in the palette and the sheet
parent: LA-BRW
component_type: react component
file: app/src/shell/commands.tsx
links:
  satisfies: [LA-BRW-UC91-R02, LA-BRW-UC91-R04, LA-BRW-DR110]
  depends_on: [LA-BRW-C106]
---
`useShortcutHint` gives any control its keys and `aria-keyshortcuts` from the keymap with overrides; the palette shows each row's keys right-aligned in `<kbd>` with `aria-keyshortcuts`; both the palette and the sheet use the title a handler gives ("Switch to Lathe").
