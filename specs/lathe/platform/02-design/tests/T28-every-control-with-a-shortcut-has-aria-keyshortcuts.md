---
id: LA-PLT-T28
kind: test
title: Every control with a shortcut has aria-keyshortcuts
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-PLT-UC04-R03, LA-PLT-DR09, LA-PLT-UC03-R07]
---
Expects `aria-keyshortcuts` on the nav toggle, quick find, the spaces, Checks, the view toggles (Alt+W and Alt+G first, off a Mac) and the side bar toggles, the depth buttons and full screen (Ctrl+3), and none for a sequence.
