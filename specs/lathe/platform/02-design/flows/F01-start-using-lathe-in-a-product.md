---
id: LA-PLT-F01
kind: flow
title: Start using Lathe in a product
parent: LA-PLT-CAP03
links:
  carries_out: [LA-AUT-UC03, LA-PLT-UC01]
---
1. The owner installs the Lathe package in the product's repo and runs `lathe init` with the product's name and prefix.
2. They write the first domain and records, run `lathe check`, and open `lathe serve` to browse them.
3. A tool of their own loads the same workspace in code with `loadWorkspace(root)` and reads its records, problems and coverage.
