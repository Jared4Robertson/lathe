---
id: LA-PLT-T101
kind: test
title: The graph's trail is a Tab stop only while it overflows
parent: LA-PLT
test_type: component
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-PLT-UC10-R02]
---
Opens a record in the Graph view and expects the trail's list to take no Tab stop while it fits, since its links are the stops. Then makes the list wider than its box, re-centers, and expects the list to become a Tab stop so the keyboard can scroll it.
