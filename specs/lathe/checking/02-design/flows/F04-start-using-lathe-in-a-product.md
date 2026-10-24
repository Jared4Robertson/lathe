---
id: LA-CHK-F04
kind: flow
title: Start using Lathe in a product
parent: LA-CHK-CAP04
links:
  carries_out: [LA-CHK-UC04, LA-CHK-UC06]
---
1. Jared installs the Lathe package in the product's repo and runs `lathe init` with the product's name and prefix.
2. He writes the first domain and records, runs `lathe check`, and opens `lathe serve` to browse them.
3. A tool of his own loads the same workspace in code with `loadWorkspace(root)` and reads its records, problems and coverage.
