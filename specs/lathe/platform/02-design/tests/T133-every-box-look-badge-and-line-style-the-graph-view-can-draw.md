---
id: LA-PLT-T133
kind: test
title: Every box look, badge and line style the Graph view can draw is in its key
parent: LA-PLT
test_type: unit
run_by: app/test/marks-have-meaning.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Renders the Graph view's legend and expects an entry, with words beside it, for each look the canvas draws a box in (each stage's colors, a group's, a file's, a domain event's and an open question's), the focus's ring, each shape, a Nested box and a Voronoi cell, the bar, each badge, each line style a relation can take, and the cross-link.
