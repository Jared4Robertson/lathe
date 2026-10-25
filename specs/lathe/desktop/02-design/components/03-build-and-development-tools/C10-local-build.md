---
id: LA-DSK-C10
kind: component
title: Local build
parent: LA-DSK-LAY03
component_type: script
file: desktop/scripts/stage-lathe.ts
links:
  satisfies: [LA-DSK-UC02-R05]
  depends_on: [LA-DSK-C01]
---
Packs the built Lathe package with `npm pack` and installs it with its production dependencies (DuckDB, yaml) into `desktop/build/stage`, which electron-builder copies into the app's resources. electron-builder's settings in `desktop/package.json` name no signing identity, no publishing and the local Electron; `build/icon.png`, rendered from `build/icon.svg` (the chuck from `brand/chuck.svg`) by `scripts/icon.ts`, is the icon it sizes.
