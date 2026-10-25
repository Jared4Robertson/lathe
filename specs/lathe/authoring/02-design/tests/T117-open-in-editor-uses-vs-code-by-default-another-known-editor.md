---
id: LA-AUT-T117
kind: test
title: Open in editor uses VS Code by default, another known editor, the default app or a command of one's own
parent: LA-AUT
test_type: unit
run_by: desktop/test/editor.test.ts
links:
  proves: [LA-AUT-UC16-R02]
---
Reads settings with VS Code as the fallback, opens known editors by bundle ID on macOS and by command elsewhere, passes the file to a custom command as an argument and never in its text, and names the editor for the menu.
