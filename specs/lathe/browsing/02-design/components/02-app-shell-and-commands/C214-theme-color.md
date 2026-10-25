---
id: LA-BRW-C214
kind: component
title: Theme color
parent: LA-BRW-LAY02
component_type: module
file: app/src/shell/themeColor.ts
links:
  satisfies: [LA-BRW-UC116-R09]
---
Keeps `<meta name="theme-color">` (declared in `app/index.html`) at the theme's `--sheet` color, following the system's light and dark mode, a theme set on the root element and a theme stylesheet in the head.
