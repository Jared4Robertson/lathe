---
id: LA-CHK-C90
kind: component
title: Product checks setting
parent: LA-CHK-LAY02
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-CHK-UC15-R01, LA-CHK-UC15-R05, LA-CHK-DR94]
---
Reads the optional `checks` key of `lathe.config.json` into `LatheConfig.checksDir`, resolved against the root, or null when the key is absent.
