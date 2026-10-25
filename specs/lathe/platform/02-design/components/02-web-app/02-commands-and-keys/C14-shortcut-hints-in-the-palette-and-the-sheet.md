---
id: LA-PLT-C14
kind: component
title: Shortcut hints in the palette and the sheet
parent: LA-PLT-LAY04
component_type: react component
file: app/src/shell/commands.tsx
links:
  satisfies: [LA-PLT-UC04-R02, LA-PLT-UC04-R04, LA-PLT-DR07]
  depends_on: [LA-PLT-C13]
---
`useShortcutHint` gives any control its keys and `aria-keyshortcuts` from the keymap with overrides; the palette shows each row's keys right-aligned in `<kbd>` with `aria-keyshortcuts`; both the palette and the sheet use the title a handler gives ("Switch to Lathe").
