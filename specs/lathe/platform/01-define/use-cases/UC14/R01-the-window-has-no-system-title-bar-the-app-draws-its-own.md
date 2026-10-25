---
id: LA-PLT-UC14-R01
kind: requirement
title: The window has no system title bar; the app draws its own
parent: LA-PLT-UC14
---
A window MUST have no system title bar. The app MUST draw its own 38 px bar across the top of the window, on the shell color (`--shell`) with no border, so the bar and the shell are one surface, and lay the page out under it. On macOS the traffic lights MUST float over the bar's left end, centered in its height; on Windows and Linux the native window controls MUST draw over its right end. The bar MUST leave room for them. The window MUST keep its title and, on macOS, its represented folder, which the Window menu and Mission Control show.
