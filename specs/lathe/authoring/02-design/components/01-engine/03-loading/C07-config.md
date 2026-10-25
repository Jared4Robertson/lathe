---
id: LA-AUT-C07
kind: component
title: Product configuration
parent: LA-AUT-LAY04
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-PLT-UC01-R02, LA-PLT-UC01-R03]
---
`loadConfig(root)` reads `lathe.config.json` (specs folder, `metaExtensions` folder, checks folder, `idPrefixes`, `structure`) with defaults, refuses any other setting by name, and finds the installed package's own folder, which holds the default meta-model and the checks.
