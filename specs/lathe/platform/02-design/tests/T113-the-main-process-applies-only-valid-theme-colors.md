---
id: LA-PLT-T113
kind: test
title: The main process applies only valid theme colors to a window's chrome
parent: LA-PLT
test_type: unit
run_by: desktop/test/chrome.test.ts
links:
  proves: [LA-PLT-DR36, LA-PLT-UC13-R06]
---
Applies a valid chrome to a stand-in window and expects its background set, and off a Mac its overlay; then sends names, alpha colors, `rgb()`, injected text, numbers, missing and extra keys, and expects each refused with nothing changed.
