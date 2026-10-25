---
id: LA-PLT-C45
kind: component
title: Preload
parent: LA-PLT-LAY10
component_type: electron preload
file: desktop/src/preload.cts
links:
  satisfies: [LA-PLT-DR29, LA-PLT-UC12-R02, LA-PLT-UC12-R03, LA-PLT-UC13-R06, LA-AUT-UC16-R01, LA-PLT-UC14-R12]
---
Runs sandboxed and exposes only `window.latheDesktop`: `isDesktop`, `platform`, `onCommand(listener)`, which returns an unsubscribe function, `setChrome({ background, foreground })`, which passes the two values on to the main process to check, `onFullScreen(listener)`, called at once and whenever the window enters or leaves full screen, `setErrorCount(count)` for the Dock badge, and the record actions `revealRecord`, `openRecordInEditor`, `copyRecordId` and `showRecordMenu`, which send only a record ID. Its type is `Window['latheDesktop']` in `app/src/shell/commands.tsx`. A menu choice goes to the app's listeners by command ID; until the app subscribes, the preload presses the command's default keys in the page, so the app's keymap runs it.
