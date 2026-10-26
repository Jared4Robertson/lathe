---
id: LA-EXP-T190
kind: test
title: "Every title in Lathe's spec and the Tool Library wraps on whole words, none broken inside a word"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
Reads every record of Lathe's own spec and the Tool Library's, wraps each title as its box would (in its kind's shape's room), and expects the lines to give the title back, every line but the last to end after a space or after a hyphen inside one word too wide for a line, and a component's file path to break only after a slash or a hyphen.
