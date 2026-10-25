---
id: LA-EXP-DR60
kind: domain_rule
title: "The graph draws only what is in view and big enough to see"
parent: LA-EXP-A4
---
The graph MUST draw only the nodes in view (with a tenth of the pane to spare each way) and at least 3 pixels tall on screen. A node MUST be labeled only when its text reads, its content at 0.6 of a leaf's size or more and 18 pixels tall or more; smaller, it MUST be a plain filled box with no text, out of the keyboard order and hidden from assistive technology, its name in its tooltip. A drawn node's children too small to draw MUST be one bar in their level for each run of them. Level by level from the roots, a level that would take the drawing past 260 boxes MUST be drawn as one bar per parent instead, so a product of thousands of records stays within the performance budgets (`LA-PAT-APP-UX-R11`). Labels appear as the person zooms in. What a glide passes over MUST be drawn once, as it starts, and trimmed when it ends, so no frame of the glide draws anew.
