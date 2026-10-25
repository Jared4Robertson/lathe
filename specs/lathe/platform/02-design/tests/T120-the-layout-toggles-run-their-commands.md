---
id: LA-PLT-T120
kind: test
title: The layout toggles run the navigation and side bar commands and show whether each panel shows
parent: LA-PLT
test_type: component
run_by: app/test/desktop-title-bar.test.tsx
links:
  proves: [LA-PLT-UC14-R04]
---
Clicks the navigation toggle twice and the side bar toggle twice, and expects the nav to collapse and expand and the side bar to hide and show, with each toggle's `aria-pressed` following.
