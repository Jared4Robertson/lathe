---
id: LA-DSK-T12
kind: test
title: The title bar is drawn only in the desktop app, with room for the window's controls on each platform
parent: LA-DSK
test_type: component
run_by: app/test/desktop-title-bar.test.tsx
links:
  proves: [LA-DSK-UC04-R07, LA-DSK-UC04-R01]
---
Opens a record without `window.latheDesktop` and expects no title bar; then with it, on macOS and on Windows, and expects the bar above the app shell with the platform's room for the window's controls.
