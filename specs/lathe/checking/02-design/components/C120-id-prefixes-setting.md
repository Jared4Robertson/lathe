---
id: LA-CHK-C120
kind: component
title: ID prefixes setting
parent: LA-CHK
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-CHK-UC18-R05, LA-CHK-DR124]
---
Reads the optional `idPrefixes` key of `lathe.config.json` into `LatheConfig.idPrefixes` (an empty list when absent), and throws when it is not a list of ID-shaped strings.
