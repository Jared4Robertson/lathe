---
id: LA-EXP-T21
kind: test
title: Arrow keys move between nodes, Enter re-centers and Escape clears filters
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R06]
---
Focuses the center node, moves with the arrow keys, presses Enter and expects the graph to re-center with focus on the new center; then hides a kind and expects Escape to show it again.
