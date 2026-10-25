---
id: LA-EXP-T26
kind: test
title: The page draws the map in columns with a solid parent/child spine, and links between siblings never move anything
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R08, LA-EXP-DR57]
---
Opens a requirement's graph with Links on and expects the use case left of the requirement, the component and the test that link to it at their own places in the map, and a solid spine; then two sibling aggregates that link to each other, in one column, with both links drawn between them.
