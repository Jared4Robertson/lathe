---
id: LA-DSK-T17
kind: test
title: The title bar in a real window
parent: LA-DSK-CAP01
state: manual
test_type: acceptance
links:
  proves: [LA-DSK-UC04-R01, LA-DSK-UC04-R05, LA-DSK-UC04-R06]
---
Manual because it watches the window's own controls and the system's gestures, which only a person at the screen sees. Run it after changing `desktop/src/chrome.ts` or `app/src/shell/DesktopTitleBar.tsx`.

1. Run `npm --prefix desktop start`. The window has no system title bar; the traffic lights sit centered in Lathe's bar, clear of the back button.
2. Drag the bar between its controls: the window moves. Double-click it there: the window zooms (or minimizes, if the system's setting says so). Click each control: it acts and the window does not move.
3. Narrow the window: the command center shortens with an ellipsis and stays centered on the window.
4. Choose another theme and switch between light and dark: the bar and the window's background follow, with no flash.

It passes when every step behaves as written.
