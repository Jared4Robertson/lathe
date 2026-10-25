---
id: LA-PLT-T123
kind: test
title: The Dock badge counts the focused product's check errors, and the Dock menu opens a new window
parent: LA-PLT
test_type: unit
run_by: desktop/test/dock.test.ts
links:
  proves: [LA-CHK-UC07-R02, LA-PLT-UC15-R04, LA-PLT-DR37]
---
Checks the badge text from 0 to over 999, that it follows the focused window or the one focused last and a new count after a reload, that only whole counts from 0 up are taken, and that New Window runs Open Product Folder.
