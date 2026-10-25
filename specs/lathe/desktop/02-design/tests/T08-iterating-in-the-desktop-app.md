---
id: LA-DSK-T08
kind: test
title: Iterating on Lathe in the desktop app
parent: LA-DSK-CAP01
state: manual
test_type: acceptance
links:
  proves: [LA-DSK-UC02-R02, LA-DSK-UC02-R03, LA-DSK-UC02-R04, LA-DSK-UC02-R05]
---
Manual because it changes files while the shell runs and builds the app. Run it after changing `desktop/scripts/` or the servers.

1. With the owner's dev server running (`npm --prefix app run dev`), run `npm --prefix desktop run dev`. The terminal says Lathe's folder comes "from shared dev server at http://localhost:5199".
2. Change a style in `app/src/styles.css`: the window updates without reloading, as the browser does.
3. Open another product folder with Cmd+O: the terminal says it comes "from own dev server" on a port other than 5199.
4. Edit a record's title under that folder's `specs/`: the page shows the new title within a second or two. Do the same in a window started with `npm --prefix desktop start`.
5. Change a comment in `desktop/src/menu.ts`: the terminal says it restarts Electron, and the windows come back. Break the file's syntax: the build fails and the running shell stays.
6. Run `npm --prefix desktop run pack`: `desktop/release/mac-arm64/Lathe.app` (or `mac` on Intel) is built, the log says code signing was skipped, and the app opens from Finder with the chuck icon (right-click › Open the first time, since it is unsigned).

It passes when every step behaves as written.
