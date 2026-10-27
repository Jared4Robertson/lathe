---
id: LA-EXP-T183
kind: test
title: "Stability: no label is clipped, in light and dark, focused or not, at several zooms"
parent: LA-EXP
test_type: domain_rule
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-DR58]
---
In light and dark, on the Exploring domain and its Define stage at depths 1 to 3 and zoomed in twice, expects every drawn box in the canvas to fit each of its lines (each line the map broke its kind and ID line and its title into), read from the drawn scene: each line's width as the canvas measures it at its drawn font at most its placed width, and the line inside its box, with half a map unit and half a pixel to spare.
