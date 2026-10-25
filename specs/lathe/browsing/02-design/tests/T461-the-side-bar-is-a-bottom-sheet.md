---
id: LA-BRW-T461
kind: test
title: "The side bar is a bottom sheet: it opens at half height with focus inside, its handle takes it to full height and back, Escape closes it and focus returns"
parent: LA-BRW
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-BRW-UC116-R04, LA-BRW-DR223, LA-BRW-UC50-R11]
---
On a phone, opens the side bar from the page bar and expects a modal bottom sheet at half height with the side bar focused, full height and back from the handle, Tab kept inside, and Escape closing it with focus back on the toggle.
