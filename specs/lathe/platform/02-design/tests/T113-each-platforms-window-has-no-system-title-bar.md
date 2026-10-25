---
id: LA-PLT-T113
kind: test
title: Each platform's window has no system title bar, with its controls over the app's own 38 px bar
parent: LA-PLT
test_type: unit
run_by: desktop/test/chrome.test.ts
links:
  proves: [LA-PLT-UC13-R01]
---
Builds the window options for macOS, Windows and Linux: a hidden title bar everywhere, the traffic lights centered in 38 px on macOS with no overlay, and elsewhere an overlay of the shell and ink colors, 38 px high.
