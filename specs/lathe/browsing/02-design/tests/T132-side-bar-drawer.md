---
id: LA-BRW-T132
kind: test
title: On a narrow screen the side bar is a bottom sheet
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R11]
---
With a narrow screen, opens the side bar from the page bar, expects a bottom sheet with focus inside, closes it with Escape and expects focus back on the toggle.
