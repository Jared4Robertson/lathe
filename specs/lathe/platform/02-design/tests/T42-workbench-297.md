---
id: LA-PLT-T42
kind: test
title: Remembered sizes come back, out-of-range ones fall back to the default, and the narrow layout has no handles
parent: LA-PLT
test_type: component
run_by: app/test/resize-handle.test.tsx
links:
  proves: [LA-PLT-UC05-R02, LA-PLT-UC05-R03]
---
Starts with a remembered navigation width and an out-of-range side bar width and expects the first kept and the second back to its default; on a narrow screen expects no resize handles.
