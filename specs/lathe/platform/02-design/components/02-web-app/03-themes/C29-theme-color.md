---
id: LA-PLT-C29
kind: component
title: Theme color
parent: LA-PLT-LAY05
component_type: module
file: app/src/shell/themeColor.ts
links:
  satisfies: [LA-PLT-UC07-R09]
---
Keeps `<meta name="theme-color">` (declared in `app/index.html`) at the theme's `--sheet` color, following the system's light and dark mode, a theme set on the root element and a theme stylesheet in the head.
