---
id: LA-DSK-T11
kind: test
title: The main process applies only valid theme colors to a window's chrome
parent: LA-DSK
test_type: unit
run_by: desktop/test/chrome.test.ts
links:
  proves: [LA-DSK-DR11, LA-DSK-UC04-R06]
---
Applies a valid chrome to a stand-in window and expects its background set, and off a Mac its overlay; then sends names, alpha colors, `rgb()`, injected text, numbers, missing and extra keys, and expects each refused with nothing changed.
