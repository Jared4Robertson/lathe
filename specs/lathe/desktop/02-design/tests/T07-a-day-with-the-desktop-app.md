---
id: LA-DSK-T07
kind: test
title: A day with the desktop app
parent: LA-DSK-CAP01
state: manual
test_type: acceptance
links:
  proves: [LA-DSK-UC01-R04, LA-DSK-DR02, LA-DSK-DR05, LA-DSK-DR07, LA-DSK-DR10]
---
Manual because it watches what only a person at the screen sees: a flash, the Dock and real windows. Run it after changing `desktop/src/main.ts`.

1. Run `npm --prefix desktop start`. Lathe's repo opens in a window with no white flash, in light and in dark appearance.
2. Press Cmd+O and choose a folder with neither `lathe.config.json` nor `specs/`: a message says what is missing and no window opens. Choose another product's folder: a second window opens.
3. Choose File › Open Recent › Lathe's folder: the first window comes forward; no third window opens.
4. Click a link to an outside site in a record: it opens in the system browser, and the window stays on Lathe.
5. Move and resize the window, quit with Cmd+Q, and run `npm --prefix desktop start` again: the last folder opened reopens in its saved place.
6. Close every window, then run `ps -A | grep vite`: no dev server the shell started is left.

It passes when every step behaves as written.
