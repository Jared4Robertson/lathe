---
id: LA-PLT-C47
kind: component
title: Local build
parent: LA-PLT-LAY11
component_type: script
file: desktop/scripts/stage-lathe.ts
links:
  satisfies: [LA-PLT-UC11-R05]
  depends_on: [LA-PLT-C38]
---
Packs the built Lathe package with `npm pack` and installs it with its production dependencies (DuckDB, yaml) into `desktop/build/stage`, which electron-builder copies into the app's resources. electron-builder's settings in `desktop/package.json` name no signing identity, no publishing and the local Electron; Its icons are `build/icon.icns`, `build/icon.ico` and `build/icons/` (`LA-PLT-C55`), and the packed app declares folders as documents it views, so Finder and the Dock can hand it a folder.
