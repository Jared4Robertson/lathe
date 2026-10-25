---
id: LA-PLT-T108
kind: test
title: The desktop app opens a product folder in a window, bridges only window.latheDesktop and runs a menu command
parent: LA-PLT-CAP04
test_type: acceptance
run_by: desktop/test/smoke.test.ts
links:
  proves: [LA-PLT-UC10-R02, LA-PLT-UC12-R02, LA-PLT-UC12-R03, LA-PLT-UC13-R01, LA-PLT-UC13-R06, LA-PLT-UC14-R01, LA-PLT-UC14-R10, LA-PLT-DR29]
---
Checks the built icons (the `.icns`, the `.ico`, each Linux size and the DEV variant). Then runs the real shell, hidden, on a temporary product folder with `serve()` from the built package and a throwaway user data folder: checks that the launch view said "Opening Smoke Shop…" before the page loaded and lifted once it had its specs, that the Dock icon is the 1024 px app icon, that the page shows the product's name, that `GET /api/spec` answered 200 (so DuckDB loads in Electron), the window's title, that the page has `window.latheDesktop` with only its ten members and no Node, that the window has a hidden title bar (`titleBarStyle`) and the page draws its own 38 px bar with its controls, that the page sent its theme's chrome colors and the main process applied them, that Help › Keyboard Shortcuts opens the shortcuts sheet, and that the folder went into the recent list. It runs only on macOS, since Electron on Linux CI needs a display server. It turns off macOS window restoration for the unpacked Electron first, asks a run that hangs to quit through its stdin before SIGTERM and then SIGKILL, and leaves no Electron running.
