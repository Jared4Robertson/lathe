---
id: LA-PLT-T41
kind: test
title: A handle resizes its panel with the arrow keys, Shift, Home and End, remembers it, and double-click resets it
parent: LA-PLT
test_type: component
run_by: app/test/resize-handle.test.tsx
links:
  proves: [LA-PLT-UC05-R01, LA-PLT-UC05-R02]
---
Steps the navigation's gap with Right, Shift and Left, and End, expects the stored and applied width, resets it by double-click, and steps the side bar's gap, where Left grows it, and Home.
