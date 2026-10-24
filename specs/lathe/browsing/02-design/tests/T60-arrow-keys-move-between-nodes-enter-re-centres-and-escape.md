---
id: LA-BRW-T60
kind: test
title: Arrow keys move between nodes, Enter re-centres and Escape clears filters
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC20-R06]
---
Focuses the centre node, moves with the arrow keys, presses Enter and expects the graph to re-centre with focus on the new centre; then hides a kind and expects Escape to show it again.
