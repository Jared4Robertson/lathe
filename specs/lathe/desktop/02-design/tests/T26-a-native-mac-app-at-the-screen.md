---
id: LA-DSK-T26
kind: test
title: A native Mac app at the screen
parent: LA-DSK-CAP01
state: manual
test_type: acceptance
links:
  proves: [LA-DSK-UC05-R01, LA-DSK-UC05-R03, LA-DSK-UC05-R04, LA-DSK-UC05-R05, LA-DSK-UC05-R07, LA-DSK-UC05-R09, LA-DSK-UC05-R10, LA-DSK-UC05-R11, LA-DSK-UC05-R12]
---
Manual because it watches the Dock, Finder, the system's menus and the look of the icon, which only a person at the screen sees. Run it after changing `desktop/src/main.ts`, `desktop/build/icon.svg` or `app/src/shell/desktopRecord.tsx`.

1. Run `npm --prefix desktop run dev`: the Dock shows the icon with a DEV band. Run `npm --prefix desktop run pack` and open the app from `desktop/release/`: the icon is crisp in the Dock, in Finder's list view (16 px) and in Cmd+Tab, in light and in dark appearance.
2. Open a folder whose checks report errors: the Dock badge shows their number. Fix one and save: the badge follows. Bring a window with no errors forward: the badge clears.
3. Right-click the Dock icon: New Window opens the folder picker, and the recent folders are listed (packed app).
4. Choose Lathe › About Lathe: a small window shows the versions; Source Code and Record Format open in the browser. Press Cmd+,: the focused window shows Settings.
5. On a record, click Reveal in Finder, Open in editor and Copy ID in its facts, and right-click a record row, a graph node and the page title: the native menu offers the same three and each works.
6. With the app running, run `open -a Lathe ~/some/product` (packed app) or drag a product folder onto the Dock icon: the running app opens it, and a second time brings its window forward.
7. Open a new folder: the window shows the shell color and "Opening <product>…" at once, never white. Break a record's front matter and reopen the folder: the error page shows the message; fix it and click Retry.
8. Scroll a long page: the scroll bars float over it. Right-click in quick find: Cut, Copy and Paste. Enter full screen, quit and reopen: the window comes back in full screen, and the title bar's back button sits at the left edge.
9. Force quit Lathe while it opens its window, then open it again: macOS does not ask to reopen windows.

It passes when every step behaves as written. The nav keeps the theme's own color: the system's sidebar material was left out, since it needs a transparent window and nav, which would replace every theme's nav color with the system's gray and give up the shell color that keeps a new window from flashing.
