---
id: LA-EXP-DR60
kind: domain_rule
title: "The graph draws only what is in view and big enough to see"
parent: LA-EXP-A4
---
The graph MUST draw only the nodes in view (with a tenth of the pane to spare each way) and at least 3 pixels tall on screen. Whether a node is labeled MUST be decided from its title's size on screen (its fixed size in the map, `LA-EXP-DR58`, times the camera's zoom), from the map alone without measuring the page, and decided again as the camera settles and as the person zooms: a node whose title is 7 pixels or more on screen MUST be labeled, its full title on one line. Smaller, it MUST be a plain filled box with no text, out of the keyboard order and hidden from assistive technology, its name in its tooltip. The cutoff only shows or hides a label; it never resizes one. A drawn node's children too small to draw MUST be one bar in their level for each run of them. Level by level from the roots, a level that would take the drawing past 260 boxes MUST be drawn as one bar per parent instead, so a product of thousands of records stays within the performance budgets (`LA-PAT-APP-UX-R11`). Labels appear as the person zooms in. What a glide passes over MUST be drawn once, as it starts, and trimmed when it ends, so no frame of the glide draws anew.
