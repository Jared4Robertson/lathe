---
id: LA-PLT-F06
kind: flow
title: Change Lathe and see the desktop app reload
parent: LA-PLT
links:
  carries_out: [LA-PLT-UC11]
---
1. The owner runs `npm --prefix desktop run dev`, and each window loads the 5199 dev server when it serves the opened folder, or a dev server the shell starts for it.
2. A change to the app hot-reloads the page; a change to the main process or a preload restarts Electron.
3. A change to a record reloads the page in every mode.
