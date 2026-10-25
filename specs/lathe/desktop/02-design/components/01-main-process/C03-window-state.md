---
id: LA-DSK-C03
kind: component
title: Window state
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/windowState.ts
links:
  satisfies: [LA-DSK-DR03]
---
Each folder's saved window (`window-state.json` in the user data folder): `saveWindow` records its normal bounds and whether it is maximized or full screen, and `windowFor` places the next window there, centered when that place is off every screen and shrunk to the largest screen.
