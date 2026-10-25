---
id: LA-DSK-T13
kind: test
title: Back and forward follow the app's history and are disabled at its ends
parent: LA-DSK
test_type: component
run_by: app/test/desktop-title-bar.test.tsx
links:
  proves: [LA-DSK-UC04-R02]
---
Stands in for the Navigation API: with no page either way both buttons are disabled; as pages are added behind and ahead, each enables and its click goes back or forward in the history.
