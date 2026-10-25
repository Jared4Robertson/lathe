---
id: LA-CHK-C01
kind: component
title: Command line
parent: LA-CHK-LAY02
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-CHK-UC01-R01, LA-CHK-UC01-R02, LA-CHK-UC01-R03, LA-PLT-UC01-R01]
  depends_on: [LA-AUT-C03, LA-AUT-C07, LA-PLT-C01]
---
The `lathe` command: `init` writes the product's config and first record; `check` calls `loadWorkspace` on the product repo and prints the report (errors, warnings, then a coverage line per domain and obligation kind with designed, built, proved and planned counts), or the whole workspace with `--json`, and sets the exit status; `serve` starts the static server. In this repo, `npm --prefix lathe run check` runs `check` on the repo root.
