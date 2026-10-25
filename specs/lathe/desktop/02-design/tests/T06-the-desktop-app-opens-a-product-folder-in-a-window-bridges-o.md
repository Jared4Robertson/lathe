---
id: LA-DSK-T06
kind: test
title: The desktop app opens a product folder in a window, bridges only window.latheDesktop and runs a menu command
parent: LA-DSK-CAP01
test_type: acceptance
run_by: desktop/test/smoke.test.ts
links:
  proves: [LA-DSK-UC01-R02, LA-DSK-UC03-R02, LA-DSK-UC03-R03, LA-DSK-DR04]
---
Runs the real shell, hidden, on a temporary product folder with `serve()` from the built package: checks that the page shows the product's name, that `GET /api/spec` answered 200 (so DuckDB loads in Electron), the window's title, that the page has `window.latheDesktop` with only its three members and no Node, that Help › Keyboard Shortcuts opens the shortcuts sheet, and that the folder went into the recent list. It runs only on macOS, since Electron on Linux CI needs a display server.
