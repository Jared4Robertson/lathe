---
id: LA-PLT-T27
kind: test
title: The palette shows each command's keys right-aligned in kbd styling
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-PLT-UC04-R02]
---
Expects each palette row to end in a right-aligned `<kbd>` with `aria-keyshortcuts`, and a command without keys to show none.
