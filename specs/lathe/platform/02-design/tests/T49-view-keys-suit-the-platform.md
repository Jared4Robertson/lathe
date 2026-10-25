---
id: LA-PLT-T49
kind: test
title: The view toggles have Ctrl+W, Ctrl+G and Ctrl+M on a Mac and Alt+W, Alt+G and Alt+M elsewhere, then Ctrl+1, 2 and 4, and no platform is offered a browser key
parent: LA-PLT
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-PLT-UC03-R02, LA-PLT-UC03-R07]
---
Resolves the keymap for a Mac and for other platforms and expects each view toggle's keys, Ctrl+W to match on a Mac but not Cmd+W, Alt+G but not Ctrl+G elsewhere, an override to Ctrl+W or Ctrl+G dropped off a Mac, and no binding reserved on its platform.
