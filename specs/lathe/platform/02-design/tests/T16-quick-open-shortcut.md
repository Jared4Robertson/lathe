---
id: LA-PLT-T16
kind: test
title: Ctrl+P and Ctrl+K open quick find without printing
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcuts.test.tsx
links:
  proves: [LA-PLT-UC03-R02, LA-PLT-UC03-R03]
---
Presses Ctrl+P and expects the event prevented and quick find focused; collapses the nav and expects Ctrl+K to open it; expects an unhandled Ctrl key left alone.
