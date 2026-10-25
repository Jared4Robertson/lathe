---
id: LA-PLT-T19
kind: test
title: Alt+W, Alt+G and Alt+M or Ctrl+1, 2 and 4 toggle the views, and Ctrl+3 shows the focused pane alone
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcuts.test.tsx
links:
  proves: [LA-PLT-UC03-R02, LA-PLT-UC03-R06, LA-EXP-UC05-R03]
---
Off a Mac, opens and closes views with Ctrl+2, Alt+W, Alt+G and Ctrl+1, expects the last open view to stay open and say so, expects Ctrl+4 and Alt+M to do nothing where Model is not offered, shows the focused pane alone with Ctrl+3 and back with Ctrl+3 or Escape, and expects the old full screen key to do nothing; expects the address and the announcements.
