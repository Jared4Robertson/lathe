---
id: LA-PLT-T67
kind: test
title: The theme-color meta follows the theme's --sheet token
parent: LA-PLT
test_type: unit
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC08-R09]
---
Sets `--sheet` on the root, expects the meta to take it, changes it and expects the meta to follow.
