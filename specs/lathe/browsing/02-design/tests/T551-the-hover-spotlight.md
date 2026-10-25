---
id: LA-BRW-T551
kind: test
title: "Focusing a node spotlights it, its lines and its neighbors, and leaving restores the picture"
parent: LA-BRW
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC20-R10]
---
Focuses a linked view and expects it, the requirement and their line lit and the rest not, then leaves and expects no spotlight; a context node gives none.
