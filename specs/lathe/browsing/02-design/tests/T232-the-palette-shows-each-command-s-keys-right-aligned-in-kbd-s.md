---
id: LA-BRW-T232
kind: test
title: "The palette shows each command's keys right-aligned in kbd styling"
parent: LA-BRW
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-BRW-UC91-R02]
---
Expects each palette row to end in a right-aligned `<kbd>` with `aria-keyshortcuts`, and a command without keys to show none.
