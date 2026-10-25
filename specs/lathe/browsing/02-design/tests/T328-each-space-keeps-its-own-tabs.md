---
id: LA-BRW-T328
kind: test
title: Each space keeps its own tabs, and switching spaces swaps the tab set
parent: LA-BRW
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-BRW-UC112-R06]
---
Opens two tabs in one product's space, moves to another product's page and expects only its tab, then switches back by the rail and expects the first space's two tabs again.
