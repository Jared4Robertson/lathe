---
id: LA-PLT-T16
kind: test
title: Mod is Cmd on macOS and Ctrl elsewhere
parent: LA-PLT
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-PLT-UC04-R01]
---
Normalizes and shows bindings for both platforms, turns key events into chords (physical keys with modifiers, characters without), and matches chords and sequences.
