---
id: LA-DSK-C12
kind: component
title: Desktop title bar
parent: LA-DSK-LAY02
component_type: react component
file: app/src/shell/DesktopTitleBar.tsx
links:
  satisfies: [LA-DSK-UC04-R01, LA-DSK-UC04-R02, LA-DSK-UC04-R03, LA-DSK-UC04-R04, LA-DSK-UC04-R05, LA-DSK-UC04-R07, LA-DSK-UC05-R12]
  depends_on: [LA-DSK-C08, LA-DSK-C13, LA-DSK-C21]
---
The app's own title bar, mounted at the top of the app shell (`app/src/App.tsx`) only when `window.latheDesktop` is present, with its styles in `DesktopTitleBar.css`: back and forward (disabled at the history's ends, from the Navigation API), the command center showing the page's heading and opening quick find, and the navigation and side bar toggles, which read from the page whether each panel shows. The bar is a drag region and its buttons are not; it leaves room for the traffic lights on macOS (none in full screen, where they hide) and for the window controls elsewhere (`env(titlebar-area-*)`, else a constant). It also mounts the desktop record hooks with the product's specs.
