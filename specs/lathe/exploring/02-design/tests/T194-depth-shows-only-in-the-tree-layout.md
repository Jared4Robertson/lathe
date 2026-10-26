---
id: LA-EXP-T194
kind: test
title: Depth shows only in the Tree layout
parent: LA-EXP
test_type: component
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R16]
---
Opens a stage in the Tree layout and expects the Depth buttons shown. Switches to Nested and then Voronoi, and expects the Depth group to keep its slot but be hidden, aria-hidden and inert, so it is neither seen nor reached. Switches back to Tree and expects it again.
