---
id: LA-PLT-T60
kind: test
title: "The built-in themes: Lathe is the stylesheet unchanged, High contrast reaches AAA, and the others pass AA throughout"
parent: LA-PLT
test_type: unit
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R15, LA-PLT-DR12]
  covers: [LA-PLT-C20, LA-PLT-C26]
---
Compares the Lathe theme file with the stylesheet's `:root` and dark values, expects High contrast's body and muted text at 7:1 or more in both modes, and every pair the editor checks to pass in each other built-in.
