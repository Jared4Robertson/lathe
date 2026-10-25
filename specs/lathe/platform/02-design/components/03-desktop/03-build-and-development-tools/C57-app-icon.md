---
id: LA-PLT-C57
kind: component
title: App icon
parent: LA-PLT-LAY11
component_type: script
file: desktop/scripts/icon.ts
links:
  satisfies: [LA-PLT-UC15-R01]
---
Renders `build/icon.svg` (the chuck from `brand/chuck.svg` on a plate on Apple's grid, lit from above) and `build/icon-small.svg` (the same, bolder, for 16 and 32 px) with `rsvg-convert` to `icon.icns` (iconutil), `icon.ico` (ImageMagick), `icons/` for Linux, `icon.png` and `icon-dev.png` (with a DEV band). The outputs are committed; the unpacked app sets its Dock icon from `icon.png`, or `icon-dev.png` in development.
