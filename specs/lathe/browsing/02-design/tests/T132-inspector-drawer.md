---
id: LA-BRW-T132
kind: test
title: On a narrow screen the inspector is a drawer
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R11]
---
With a narrow screen, opens the inspector from the header, expects a drawer with focus, closes it with Escape and expects focus back on the toggle.
