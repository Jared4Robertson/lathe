---
id: LA-EXP-T11
kind: test
title: Every spec page says when it shows the sample fixture
parent: LA-EXP
test_type: component
run_by: app/test/source-note.test.tsx
links:
  proves: [LA-EXP-DR02, LA-PLT-UC02-R02]
---
Serves the workspace with `x-lathe-source: fixture` and checks the note, with its reason, on every kind of spec page; served by the engine, no note is shown.
