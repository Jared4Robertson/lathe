---
id: LA-DSK
kind: domain
title: Desktop
parent: LA
---
Lathe as a desktop app: an Electron shell in `desktop/` that opens a product's folder in a window of its own, with a Dock icon and native menus, around the same web app and server the browser uses. The main process starts Lathe's server (`serve()`, `LA-CHK-C08`) in-process for each window; in development it loads the app's Vite dev server instead, so app changes hot-reload.

The owner runs it three ways:

- `npm --prefix desktop run dev`: development. Windows load the owner's dev server on port 5199 when it serves the opened folder, or a Vite dev server of the shell's own; changes to the shell restart Electron.
- `npm --prefix desktop start`: builds Lathe and runs the shell as it ships, on `serve()`.
- `npm --prefix desktop run pack`: an unsigned macOS app for this Mac in `desktop/release/` (`run pack:dmg` for a disk image).

Signed builds, notarizing, auto-update and Windows and Linux builds come later and need the owner's approval to publish. The shell draws no UI of its own beyond native menus and dialogs, so the App code pattern (`LA-PAT-APP-CODE`), which is about the web app's pages, is not followed here; the shell's code keeps its American spelling all the same.
