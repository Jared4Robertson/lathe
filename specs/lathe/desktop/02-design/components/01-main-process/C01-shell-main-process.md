---
id: LA-DSK-C01
kind: component
title: Shell main process
parent: LA-DSK-LAY01
component_type: electron main
file: desktop/src/main.ts
links:
  reacts_to: [LA-DSK-EV02]
  satisfies: [LA-DSK-UC01-R01, LA-DSK-UC01-R04, LA-DSK-DR02, LA-DSK-DR04, LA-DSK-DR05, LA-DSK-DR07, LA-DSK-DR10]
  depends_on: [LA-DSK-C02, LA-DSK-C03, LA-DSK-C04, LA-DSK-C06, LA-DSK-C07, LA-DSK-C08]
---
Opens each folder in its own `BrowserWindow` (context isolation, sandbox, no Node, the preload), hidden until ready on the shell background; keeps its title; sends links to other origins to the system browser; saves its bounds as it moves and closes; and stops its server when it closes or the shell quits (also on SIGINT and SIGTERM). On launch it opens the folder named on the command line or dropped on the Dock icon, else the most recent folder, else Lathe's repo when run from it, else the Open dialog. A second launch hands its folder to the first. With `LATHE_DESKTOP_SMOKE` set it runs the smoke check in `desktop/src/smoke.ts` and quits.
