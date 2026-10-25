---
id: LA-EXP-T114
kind: test
title: Each tab keeps its own state, and a stored set is read back with anything malformed dropped
parent: LA-EXP
test_type: unit
run_by: app/test/tabs.test.ts
links:
  proves: [LA-EXP-DR34]
---
Changes one tab's state and expects the other's unchanged; reads back a stored set with a bad path and a bad state and expects only the good tabs, the last of two stored previews kept as the preview, and an unknown active tab replaced by the first.
