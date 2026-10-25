---
id: LA-PLT-C14
kind: component
title: Tooltip
parent: LA-PLT-LAY04
component_type: react component
file: app/src/shell/Tooltip.tsx
links:
  satisfies: [LA-PLT-UC05-R01, LA-PLT-UC05-R03, LA-PLT-DR07, LA-PLT-DR10, LA-PLT-UC09-R08]
  depends_on: [LA-PLT-C12]
---
Wraps a control: shows its name and its command's keys after a short hover or at once on keyboard focus, one at a time, closed by leaving, blur, a click or Escape; sets `aria-keyshortcuts` and `aria-describedby` from the keymap.
