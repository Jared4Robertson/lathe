---
id: LA-BRW-T234
kind: test
title: Every control with a shortcut has aria-keyshortcuts
parent: LA-BRW
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-BRW-UC91-R03, LA-BRW-DR112, LA-BRW-UC51-R07]
---
Expects `aria-keyshortcuts` on the nav toggle, quick find, the spaces, Checks, the view toggles (Alt+W and Alt+G first, off a Mac) and the inspector toggles, the depth buttons and full screen (Ctrl+3), and none for a sequence.
