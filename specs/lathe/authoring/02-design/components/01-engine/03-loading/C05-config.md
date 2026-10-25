---
id: LA-AUT-C05
kind: component
title: Product configuration
parent: LA-AUT-LAY04
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-PLT-UC02-R02, LA-PLT-UC02-R03]
---
`loadConfig(root)` reads `lathe.config.json` (specs folder, `metaExtensions` folder, checks folder, `idPrefixes`, `structure`) with defaults, refuses any other setting by name, and finds the installed package's own folder, which holds the default meta-model and the checks.
