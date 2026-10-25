---
id: LA-BRW-T325
kind: test
title: Ctrl+Tab and Ctrl+Shift+Tab cycle, the keep command keeps the preview, and on the focused strip the arrow keys move and Delete closes
parent: LA-BRW
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-BRW-UC112-R02, LA-BRW-UC112-R04]
---
Expects the four tab commands in the keymap; keeps the preview with Alt+K then Enter (off a Mac); cycles with Ctrl+Tab and Ctrl+Shift+Tab; expects only the active tab in the Tab order, the arrow key to move focus, Enter to activate and Delete to close the focused tab, with focus left on the tab now active. Expects the active tab's close button to carry the close command's keys.
