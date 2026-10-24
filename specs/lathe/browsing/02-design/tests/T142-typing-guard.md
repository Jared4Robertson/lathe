---
id: LA-BRW-T142
kind: test
title: Single-key shortcuts never fire while typing
parent: LA-BRW
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-BRW-UC51-R03, LA-BRW-DR61]
---
Expects inputs, text areas and editable text to count as typing and checkboxes and buttons not to, and single keys to be told apart from chords, function keys and Escape.
