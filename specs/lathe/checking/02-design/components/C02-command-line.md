---
id: LA-CHK-C02
kind: component
title: Command line
parent: LA-CHK
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-CHK-UC01-R01, LA-CHK-UC01-R02, LA-CHK-UC01-R03]
  depends_on: [LA-CHK-C01]
---
`npm --prefix lathe run check`: calls `loadWorkspace` on the repo root and prints the report, or the whole workspace with `--json`, and sets the exit status.
