---
id: LA-PLT-C51
kind: component
title: Desktop title bar
parent: LA-PLT-LAY06
component_type: react component
file: app/src/shell/DesktopTitleBar.tsx
links:
  satisfies: [LA-PLT-UC14-R01, LA-PLT-UC14-R02, LA-PLT-UC14-R03, LA-PLT-UC14-R04, LA-PLT-UC14-R05, LA-PLT-UC14-R07, LA-PLT-UC15-R12]
  depends_on: [LA-PLT-C47, LA-PLT-C52, LA-AUT-C69]
---
The app's own title bar, mounted at the top of the app shell (`app/src/App.tsx`) only when `window.latheDesktop` is present, with its styles in `DesktopTitleBar.css`: back and forward (disabled at the history's ends, from the Navigation API), the command center showing the page's heading and opening quick find, and the navigation and side bar toggles, which read from the page whether each panel shows. The bar is a drag region and its buttons are not; it leaves room for the traffic lights on macOS (none in full screen, where they hide) and for the window controls elsewhere (`env(titlebar-area-*)`, else a constant). It also mounts the desktop record hooks with the product's specs.
