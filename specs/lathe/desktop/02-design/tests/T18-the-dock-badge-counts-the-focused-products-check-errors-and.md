---
id: LA-DSK-T18
kind: test
title: The Dock badge counts the focused product's check errors, and the Dock menu opens a new window
parent: LA-DSK
test_type: unit
run_by: desktop/test/dock.test.ts
links:
  proves: [LA-DSK-UC05-R03, LA-DSK-UC05-R04, LA-DSK-DR12]
---
Checks the badge text from 0 to over 999, that it follows the focused window or the one focused last and a new count after a reload, that only whole counts from 0 up are taken, and that New Window runs Open Product Folder.
