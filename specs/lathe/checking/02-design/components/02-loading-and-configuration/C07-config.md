---
id: LA-CHK-C07
kind: component
title: Product configuration
parent: LA-CHK-LAY02
component_type: module
file: lathe/src/config.ts
links:
  satisfies: [LA-CHK-UC06-R02, LA-CHK-UC06-R03]
---
`loadConfig(root)` reads `lathe.config.json` (specs folder, `metaExtensions` folder, checks folder, `idPrefixes`, `structure`) with defaults, refuses any other setting by name, and finds the installed package's own folder, which holds the default meta-model and the checks.
