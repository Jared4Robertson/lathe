---
id: LA-BRW-T427
kind: test
title: "The built-in themes: Lathe is the stylesheet unchanged, High contrast reaches AAA, and the others pass AA throughout"
parent: LA-BRW
test_type: unit
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R15, LA-BRW-DR201]
  covers: [LA-BRW-C190, LA-BRW-C196]
---
Compares the Lathe theme file with the stylesheet's `:root` and dark values, expects High contrast's body and muted text at 7:1 or more in both modes, and every pair the editor checks to pass in each other built-in.
