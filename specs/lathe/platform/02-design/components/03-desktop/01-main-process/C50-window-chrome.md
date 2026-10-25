---
id: LA-PLT-C50
kind: component
title: Window chrome
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/chrome.ts
links:
  satisfies: [LA-PLT-UC14-R01, LA-PLT-UC14-R06, LA-PLT-DR36]
---
The title bar options of a new window per platform (`chromeWindowOptions`): `titleBarStyle: 'hidden'` everywhere, with the traffic lights centered in the 38 px bar on macOS and a `titleBarOverlay` in the shell's colors on Windows and Linux. `parseChrome` checks what a page sends through `setChrome`, and `applyChrome` sets the window's background and, off a Mac, the controls' overlay.
