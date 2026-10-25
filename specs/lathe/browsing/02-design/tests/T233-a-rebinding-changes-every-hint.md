---
id: LA-BRW-T233
kind: test
title: A rebinding changes every hint
parent: LA-BRW
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-BRW-UC91-R04, LA-BRW-DR110]
---
Overrides two bindings and expects the tooltips, `aria-keyshortcuts`, the palette and the sheet to show the new keys.
