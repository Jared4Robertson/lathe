---
id: LA-PLT-T17
kind: test
title: Single-key shortcuts never fire while typing
parent: LA-PLT
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-PLT-UC04-R03, LA-PLT-DR05]
---
Expects inputs, text areas and editable text to count as typing and checkboxes and buttons not to, and single keys to be told apart from chords, function keys and Escape.
