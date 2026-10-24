---
id: LA-CHK-C02
kind: component
title: Command line
parent: LA-CHK
component_type: cli
file: lathe/bin/lathe.ts
links:
  satisfies: [LA-CHK-UC01-R01, LA-CHK-UC01-R02, LA-CHK-UC01-R03, LA-CHK-UC06-R01]
  depends_on: [LA-CHK-C01, LA-CHK-C07, LA-CHK-C08]
---
The `lathe` command: `init` writes the product's config and first record; `check` calls `loadWorkspace` on the product repo and prints the report (errors, warnings, then a coverage line per domain with designed, built and proved counts), or the whole workspace with `--json`, and sets the exit status; `serve` starts the static server. In this repo, `npm --prefix lathe run check` runs `check` on the repo root.
