---
id: LA-BRW-T16
kind: test
title: "Every spec page says when it shows the sample fixture"
parent: LA-BRW
test_type: component
run_by: app/test/source-note.test.tsx
links:
  proves: [LA-BRW-DR03, LA-BRW-UC05-R02]
---
Serves the workspace with `x-lathe-source: fixture` and checks the note, with its reason, on every kind of spec page; served by the engine, no note is shown.
