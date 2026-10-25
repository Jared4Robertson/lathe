---
id: LA-EXP-T119
kind: test
title: Each space keeps its own tabs, and switching spaces swaps the tab set
parent: LA-EXP
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-EXP-UC10-R06]
---
Opens two tabs in one product's space, moves to another product's page and expects only its tab, then switches back by the rail and expects the first space's two tabs again.
