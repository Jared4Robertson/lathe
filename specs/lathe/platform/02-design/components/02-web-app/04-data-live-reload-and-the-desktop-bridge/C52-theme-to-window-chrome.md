---
id: LA-PLT-C52
kind: component
title: Theme to window chrome
parent: LA-PLT-LAY06
component_type: module
file: app/src/shell/desktopChrome.ts
links:
  satisfies: [LA-PLT-UC14-R06]
  depends_on: [LA-PLT-C47]
---
The app's view of `window.latheDesktop` (`desktopBridge`), and `useDesktopChrome`, which the theme provider calls: it turns the shown theme's `--shell` and `--ink`, in the shown mode, into opaque `#rrggbb` colors and sends them through `setChrome` whenever they change, following the system's appearance while the mode is System.
