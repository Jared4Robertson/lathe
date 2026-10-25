---
id: LA-PLT-T59
kind: test
title: "The side bar is a bottom sheet: it opens at half height with focus inside, its handle takes it to full height and back, Escape closes it and focus returns"
parent: LA-PLT
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC07-R04, LA-PLT-DR17, LA-EXP-UC05-R11]
---
On a phone, opens the side bar from the page bar and expects a modal bottom sheet at half height with the side bar focused, full height and back from the handle, Tab kept inside, and Escape closing it with focus back on the toggle.
