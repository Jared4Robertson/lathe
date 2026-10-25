---
id: LA-PLT-C38
kind: component
title: Shell main process
parent: LA-PLT-LAY09
component_type: electron main
file: desktop/src/main.ts
links:
  reacts_to: [LA-PLT-EV05]
  satisfies: [LA-PLT-UC10-R01, LA-PLT-UC10-R04, LA-PLT-UC13-R01, LA-PLT-UC14-R04, LA-PLT-UC14-R09, LA-PLT-UC14-R10, LA-PLT-UC14-R12, LA-PLT-DR27, LA-PLT-DR29, LA-PLT-DR30, LA-PLT-DR32, LA-PLT-DR35, LA-PLT-DR36]
  depends_on: [LA-PLT-C39, LA-PLT-C40, LA-PLT-C41, LA-PLT-C43, LA-PLT-C44, LA-PLT-C45, LA-PLT-C48, LA-PLT-C51, LA-PLT-C52, LA-AUT-C68, LA-PLT-C53, LA-PLT-C56]
---
Opens each folder in its own `BrowserWindow` (context isolation, sandbox, no Node, no spell check, the preload) on the shell color the theme last sent (`chrome.json`), shown with the launch view over it until the page has its specs (`desktop/src/launch.ts`), or the error page when they fail, with no system title bar (`desktop/src/chrome.ts`); keeps its title; applies the chrome colors its own page sends through `setChrome`, once checked; sends links to other origins to the system browser; saves its bounds and full screen as it moves, resizes, enters or leaves full screen and closes, and tells the page about full screen; pops a native Cut, Copy and Paste menu on text, and the record menu a page asks for (`desktop/src/records.ts`); keeps the Dock badge on the focused product's error count (`desktop/src/dock.ts`); and stops its server when it closes or the shell quits (also on SIGINT and SIGTERM). On launch it opens the folder named on the command line or dropped on the Dock icon, else the most recent folder, else Lathe's repo when run from it, else the Open dialog. The app holds a single-instance lock: a second launch, or a folder from Finder or the Dock, goes to the running app (`desktop/src/instance.ts`). Scroll bars are overlay scroll bars, and macOS window restoration is off (`desktop/src/persistence.ts`). The unpacked app sets its Dock icon, with a DEV band in development. With `LATHE_DESKTOP_SMOKE` set it runs the smoke check in `desktop/src/smoke.ts` and quits.
