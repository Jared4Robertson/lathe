---
id: LA-PLT-T28
kind: test
title: A rebinding changes every hint
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-PLT-UC04-R04, LA-PLT-DR07]
---
Overrides two bindings and expects the tooltips, `aria-keyshortcuts`, the palette and the sheet to show the new keys.
