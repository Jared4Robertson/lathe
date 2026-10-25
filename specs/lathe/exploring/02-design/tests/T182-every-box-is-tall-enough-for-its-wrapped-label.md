---
id: LA-EXP-T182
kind: test
title: "Every box in a level has the level's text scale, and every box is tall enough for its label wrapped on whole words"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
In the maps of three workspaces expects every node's text scale to be its level's width over a leaf's, every node at least as tall as its wrapped label at that scale, its lines joined giving its title back and each line's estimated width within a leaf's, less the padding and a domain's chamfer; that a parent whose label needs more than its stack passes the difference to its last leaf; that wrapping breaks only after a space, a word too wide for a line after a hyphen (or a path after a slash) and then between characters; and that the estimate errs wide and a longer title, the badge's room and a hexagon take more room.
