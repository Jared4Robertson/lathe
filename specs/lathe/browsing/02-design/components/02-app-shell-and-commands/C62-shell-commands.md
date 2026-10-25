---
id: LA-BRW-C62
kind: component
title: App shell commands and redirects
parent: LA-BRW-LAY02
component_type: react component
file: app/src/App.tsx
links:
  satisfies: [LA-BRW-UC50-R01, LA-BRW-UC50-R08, LA-BRW-UC51-R02, LA-BRW-UC51-R06]
  depends_on: [LA-BRW-C53, LA-BRW-C61, LA-BRW-C51]
---
The shell around every page: the nav state (rail, drawer, menu button), the redirects from old addresses, and the commands that work everywhere (quick open, nav, focus nav, back and forward, F12, Checks, F8, `/`, and the `g` sequences).
