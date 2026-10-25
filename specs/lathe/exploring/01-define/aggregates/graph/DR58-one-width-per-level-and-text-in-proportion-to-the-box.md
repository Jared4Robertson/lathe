---
id: LA-EXP-DR58
kind: domain_rule
title: "One width per level, wide enough for its labels; text in proportion to its box"
parent: LA-EXP-EN06
---
Every node in one level of the map MUST have the same width: the larger of its proportional width and its widest label. The proportional width MUST shrink toward the leaves in proportion to the level's typical height (its median weighted by height), never narrower than the proportional width below and at most three times as wide, and the products' level at most one and a half times its domains' level, so the product's picture stays usable. The gaps between siblings and between levels grow with the proportional width, so a parent's height never depends on its children's titles.

A node's label is part of the map. Its text scale MUST be its height over a leaf's (1 for a leaf), set once when the map is built, so nodes of one height in a level have one text size. Its title, its kind and ID line, its padding and its problem badge MUST grow by that scale (`--node-scale`), in map units, whatever the person's text size; its border, outline and parent line's stroke grow by its box's scale (`--box-scale`), the smaller of its width and height over a leaf's, never below 1. The text MUST never change size relative to its box: not when the focus changes, not when the camera zooms or settles, with no compensation for its size on screen; only the camera changes how big it looks.

Each level MUST be wide enough for every label in it on one line at its text scale, its padding, the badge's room and a domain's chamfer included, so a title is never wrapped, cut off or ended with an ellipsis. Widths MUST come from estimated text widths (a table of character widths for the label's faces, erring a few percent wide), never by measuring the page, so the map is laid out once per spec load. Each line's height MUST be in proportion to its text, so no glyph is clipped. A grown node's label MUST be centered in it, horizontally and vertically.
