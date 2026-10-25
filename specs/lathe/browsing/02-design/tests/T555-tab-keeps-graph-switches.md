---
id: LA-BRW-T555
kind: test
title: A tab keeps the graph's Links switch across a reload
parent: LA-BRW
test_type: component
run_by: app/test/group-names-and-tab-settings.test.tsx
links:
  proves: [LA-BRW-UC112-R05, LA-BRW-UC112-R06]
---
Turns the graph's Links switch on, reloads the page, and expects the same tab to come back with Links still on.
