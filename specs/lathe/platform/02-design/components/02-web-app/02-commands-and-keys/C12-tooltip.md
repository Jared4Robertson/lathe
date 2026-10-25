---
id: LA-PLT-C12
kind: component
title: Tooltip
parent: LA-PLT-LAY04
component_type: react component
file: app/src/shell/Tooltip.tsx
links:
  satisfies: [LA-PLT-UC04-R01, LA-PLT-UC04-R03, LA-PLT-DR07, LA-PLT-DR10, LA-PLT-UC08-R08]
  depends_on: [LA-PLT-C10]
---
Wraps a control: shows its name and its command's keys after a short hover or at once on keyboard focus, one at a time, closed by leaving, blur, a click or Escape; sets `aria-keyshortcuts` and `aria-describedby` from the keymap.
