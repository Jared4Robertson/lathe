---
id: LA-PAT-APP-UX-R12
kind: pattern_rule
title: Every drawn box shows its name
parent: LA-PAT-APP-UX
group: Look and feel
---
In every layout of the graph (Tree, Nested and Voronoi, and any layout added later), at every focus and depth, every box the app draws MUST show its name: its title in full, wrapped on whole words and never clipped, and its kind and ID line, at the box's fixed size in the map, however small it is on screen. A box is either drawn with its label or not drawn at all: off screen, under about 3 pixels, or past the drawing budget, a bar or its parent stands for it (`LA-EXP-DR60`). Every box at one level of the Tree (by depth) and the Nested layout (by height from the leaves) has one text scale, a Voronoi cell's text is its own size's (`LA-EXP-DR64`), and layouts are built so that every label fits its box at it by construction, from the leaves up.

It is proved at the unit level by a sweep over the repo's own specs (Lathe's and the Tool Library's), every layout, every domain, stage and folder focused at depths 1 to 3 in a 770 by 640 and a 1200 by 800 pane with the real camera (`app/test/graph/readable.test.ts`, in `npm --prefix app test`), and in the browser by the stability suite, which focuses each of Lathe's domains in each layout and checks every drawn box has visible title text.
