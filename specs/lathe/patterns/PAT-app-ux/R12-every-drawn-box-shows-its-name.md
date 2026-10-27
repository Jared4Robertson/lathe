---
id: LA-PAT-APP-UX-R12
kind: pattern_rule
title: Every drawn box shows its name
parent: LA-PAT-APP-UX
group: Look and feel
---
In every layout of the graph (Tree, Nested and Voronoi, and any layout added later), at every focus and depth, every box the app draws MUST show its name: its title in full, wrapped on whole words and never clipped, and its kind and ID line, at the box's fixed size in the map, however small it is on screen. A box is either drawn with its label or not drawn at all: off screen, under about 3 pixels, or past the drawing budget, a bar or its parent stands for it (`LA-EXP-DR60`). In every layout siblings are the same size with one text scale, the largest at which every sibling's whole label fits its box (`LA-EXP-DR58`), so every label fits its box by construction; a very small box has very small text, read by zooming in.

It is proved at the unit level by a sweep over the repo's own specs (Lathe's and the Tool Library's), every layout, every domain, stage and folder focused at depths 1 to 3 in a 770 by 640 and a 1200 by 800 pane with the real camera (`app/test/graph/readable.test.ts`, in `npm --prefix app test`), and in the browser by the stability suite, which focuses each of Lathe's domains in each layout and checks every drawn box has visible title text.
