---
id: LA-PLT-UC12-R03
kind: requirement
title: A change to the main process or preload restarts Electron
parent: LA-PLT-UC12
---
`npm --prefix desktop run dev` MUST rebuild the shell and restart Electron whenever a file under `desktop/src` changes. A build that fails MUST leave the running shell as it is.
