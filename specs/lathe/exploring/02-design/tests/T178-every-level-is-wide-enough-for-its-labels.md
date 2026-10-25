---
id: LA-EXP-T178
kind: test
title: "Every level is wide enough for each label in it on one line at its fixed text scale"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
In the maps of three workspaces expects every node's text scale to be its height over a leaf's, and its width at least its label's estimated width at that scale, with the badge's room and a domain's chamfer; and checks that the estimate errs wide and grows with a longer title, a badge and a hexagon.
