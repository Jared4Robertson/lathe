---
id: LA-DSK-C01
kind: component
title: Shell main process
parent: LA-DSK-LAY01
component_type: electron main
file: desktop/src/main.ts
links:
  reacts_to: [LA-DSK-EV02]
  satisfies: [LA-DSK-UC01-R01, LA-DSK-UC01-R04, LA-DSK-UC04-R01, LA-DSK-UC05-R04, LA-DSK-UC05-R09, LA-DSK-UC05-R10, LA-DSK-UC05-R12, LA-DSK-DR02, LA-DSK-DR04, LA-DSK-DR05, LA-DSK-DR07, LA-DSK-DR10, LA-DSK-DR11]
  depends_on: [LA-DSK-C02, LA-DSK-C03, LA-DSK-C04, LA-DSK-C06, LA-DSK-C07, LA-DSK-C08, LA-DSK-C11, LA-DSK-C14, LA-DSK-C15, LA-DSK-C16, LA-DSK-C18, LA-DSK-C22]
---
Opens each folder in its own `BrowserWindow` (context isolation, sandbox, no Node, no spell check, the preload) on the shell color the theme last sent (`chrome.json`), shown with the launch view over it until the page has its specs (`desktop/src/launch.ts`), or the error page when they fail, with no system title bar (`desktop/src/chrome.ts`); keeps its title; applies the chrome colors its own page sends through `setChrome`, once checked; sends links to other origins to the system browser; saves its bounds and full screen as it moves, resizes, enters or leaves full screen and closes, and tells the page about full screen; pops a native Cut, Copy and Paste menu on text, and the record menu a page asks for (`desktop/src/records.ts`); keeps the Dock badge on the focused product's error count (`desktop/src/dock.ts`); and stops its server when it closes or the shell quits (also on SIGINT and SIGTERM). On launch it opens the folder named on the command line or dropped on the Dock icon, else the most recent folder, else Lathe's repo when run from it, else the Open dialog. The app holds a single-instance lock: a second launch, or a folder from Finder or the Dock, goes to the running app (`desktop/src/instance.ts`). Scroll bars are overlay scroll bars, and macOS window restoration is off (`desktop/src/persistence.ts`). The unpacked app sets its Dock icon, with a DEV band in development. With `LATHE_DESKTOP_SMOKE` set it runs the smoke check in `desktop/src/smoke.ts` and quits.
