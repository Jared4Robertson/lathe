---
id: LA-EXP-T182
kind: test
title: In the Tree map siblings share one text scale, their column's width's share or the largest at which every sibling's label fits, and every label fits its box
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
In the Tree maps of three workspaces and three synthetic trees expects every group of siblings to share one box size and one text scale, above 0, equal to the least of their labels' largest fits within their column's width over 400 (a title with a word too wide for its column lowering its siblings' scale with its own); every label's lines to give back its title and its kind and ID line, each line's estimated width within its box's width over its scale, less the padding, its shape's room and (beside the kind and ID line) its marks and badge, no word broken, its lines and border no taller than its box, and every label centered; and that the estimate errs wide and wrapping breaks only after a space, a word too wide for a line after a hyphen (or a path after a slash) and then between characters.
