---
id: LA-PLT-C11
kind: component
title: App shell commands
parent: LA-PLT-LAY04
component_type: react component
file: app/src/App.tsx
links:
  satisfies: [LA-EXP-UC05-R01, LA-EXP-UC05-R08, LA-PLT-UC03-R02, LA-PLT-UC03-R06]
  depends_on: [LA-EXP-C16, LA-PLT-C10, LA-EXP-C14]
---
The shell around every page: the nav state (rail, sheet, menu button), on a phone the top bar and the quick find sheet (`app/src/shell/MobileBar.tsx`) and the theme-color meta, and the commands that work everywhere (quick open, nav, focus nav, back and forward, F12, Checks, F8, `/`, and the `g` sequences).
