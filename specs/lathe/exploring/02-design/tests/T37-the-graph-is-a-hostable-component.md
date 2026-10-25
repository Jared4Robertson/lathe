---
id: LA-EXP-T37
kind: test
title: The graph is a component that reports moves through a callback and fits a resized container
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R06]
---
Renders the graph view on its own with a callback and its own link addresses, clicks a node and a panel link and expects the callback, not an address change; then resizes its container and expects the picture fitted again.
