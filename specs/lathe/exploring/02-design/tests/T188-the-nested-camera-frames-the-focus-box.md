---
id: LA-EXP-T188
kind: test
title: "In the Nested view the camera frames the focus box and depth labels the levels inside it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-DR63]
---
Frames a domain, a stage and a record in the Nested map on a canvas of 1000 by 800 and expects the focus's box centered and within the padding; at depths 1 to 3 expects boxes nested deeper than the depth inside the focus plain and the rest labeled while readable, labels deeper down once zoomed in 1.25 times further, a parent drawn before its children, nothing drawn out of view or under 3 pixels, and the drawing within its budget.
