---
id: LA-BRW-T141
kind: test
title: Mod is Cmd on macOS and Ctrl elsewhere
parent: LA-BRW
test_type: unit
run_by: app/test/keymap.test.ts
links:
  proves: [LA-BRW-UC51-R01]
---
Normalizes and shows bindings for both platforms, turns key events into chords (physical keys with modifiers, characters without), and matches chords and sequences.
