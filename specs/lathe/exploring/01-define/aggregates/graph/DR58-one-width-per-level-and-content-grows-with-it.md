---
id: LA-EXP-DR58
kind: domain_rule
title: "Every node in a level has one width, and its content grows with it"
parent: LA-EXP-EN06
---
Every node in one level of the map MUST have the same width. Widths MUST shrink toward the leaves in proportion to the level's typical height (its median weighted by height), never narrower than the level below and at most three times as wide, and the products' level at most one and a half times its domains' level, so the product's picture stays usable; a level of leaves keeps a leaf's width. The gaps between siblings and between levels grow with the level's width.

Everything inside a node MUST stay in proportion to it: its title, kind and ID line, chevron, padding, border, marks and its parent line's stroke MUST grow by one scale, the smaller of its width over a leaf's and its height over a leaf's, never below 1, set as CSS variables, never by measuring text: the border, the outline and the parent line's stroke on its box's scale (`--box-scale`), and the text, padding, marks and chevron on the same scale or more when the camera is zoomed out far enough that the text would not read (`--node-scale`, LA-EXP-DR60). A grown node's content MUST be centered in it, horizontally and vertically.
