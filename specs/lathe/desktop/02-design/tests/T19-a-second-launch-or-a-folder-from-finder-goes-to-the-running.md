---
id: LA-DSK-T19
kind: test
title: A second launch or a folder from Finder goes to the running app, which opens or focuses its window
parent: LA-DSK
test_type: unit
run_by: desktop/test/instance.test.ts
links:
  proves: [LA-DSK-UC05-R09, LA-DSK-DR02]
---
Reads the folder from unpacked and packed command lines, routes a second launch to open its folder (relative to where it was launched) or to bring the app forward, routes a folder from Finder now or once ready, and finds an open folder's window however its path is spelled.
