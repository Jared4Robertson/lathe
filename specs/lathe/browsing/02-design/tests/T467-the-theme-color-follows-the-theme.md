---
id: LA-BRW-T467
kind: test
title: The theme-color meta follows the theme's --sheet token
parent: LA-BRW
test_type: unit
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-BRW-UC116-R09]
---
Sets `--sheet` on the root, expects the meta to take it, changes it and expects the meta to follow.
