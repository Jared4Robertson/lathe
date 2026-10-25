---
id: LA-AUT-C25
kind: component
title: ID prefixes setting
parent: LA-AUT-LAY04
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-AUT-UC08-R05, LA-AUT-DR31]
---
Reads the optional `idPrefixes` key of `lathe.config.json` into `LatheConfig.idPrefixes` (an empty list when absent), and throws when it is not a list of ID-shaped strings.
