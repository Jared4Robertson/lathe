---
id: LA-EXP-DR60
kind: domain_rule
title: "The graph draws only what is in view and big enough to see"
parent: LA-EXP-A4
---
The graph MUST draw only the nodes in view (with a tenth of the pane to spare each way) and at least 3 pixels tall on screen. Every drawn node MUST show its label, its kind and ID line and its full title wrapped on whole words, at its fixed size in the map (`LA-EXP-DR58`), however small it is on screen (small text is read by zooming in): whether a node is drawn never depends on whether its text can be read, and the focus and the depth decide only what the camera frames (`LA-EXP-DR59`). Each frame the canvas MUST draw each drawn node's shape, border and fill, and its label's lines at their map size times the zoom; a line under 2 pixels on screen MAY be drawn as a faint bar where its glyphs would be, which still shows the label. A drawn node's children too small to draw MUST be one bar in their level for each run of them. Level by level from the roots, a level that would take the drawing past 260 boxes MUST be drawn as one bar per parent instead, so a product of thousands of records stays within the performance budgets (`LA-PAT-APP-UX-R11`). The keyboard's layer of drawn boxes (`LA-EXP-DR59`) MUST take what a glide passes over once, as it starts, and be trimmed when it ends, so no frame of the glide rebuilds it.
