---
id: LA-BRW-C105
kind: component
title: Tooltip
parent: LA-BRW-LAY02
component_type: react component
file: app/src/shell/Tooltip.tsx
links:
  satisfies: [LA-BRW-UC91-R01, LA-BRW-UC91-R03, LA-BRW-DR110, LA-BRW-DR113, LA-BRW-UC117-R08]
  depends_on: [LA-BRW-C61]
---
Wraps a control: shows its name and its command's keys after a short hover or at once on keyboard focus, one at a time, closed by leaving, blur, a click or Escape; sets `aria-keyshortcuts` and `aria-describedby` from the keymap.
