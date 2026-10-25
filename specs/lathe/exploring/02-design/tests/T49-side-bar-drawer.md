---
id: LA-EXP-T49
kind: test
title: On a narrow screen the side bar is a bottom sheet
parent: LA-EXP
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-EXP-UC05-R11]
---
With a narrow screen, opens the side bar from the page bar, expects a bottom sheet with focus inside, closes it with Escape and expects focus back on the toggle.
