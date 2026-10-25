---
id: LA-EXP-T128
kind: test
title: Records new to the picture fade in and records leaving fade out; the first picture has neither
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R09]
---
Expects the records only in the new picture to enter, the records only in the last one to leave, none for the same picture in another order, and none for a first picture.
