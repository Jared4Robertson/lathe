---
id: LA-EXP-T150
kind: test
title: Focusing a node spotlights it, its lines and its neighbors, and leaving restores the picture
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R10]
---
Focuses a linked view and expects it, the requirement and their line lit and the rest not, then leaves and expects no spotlight; a context node gives none.
