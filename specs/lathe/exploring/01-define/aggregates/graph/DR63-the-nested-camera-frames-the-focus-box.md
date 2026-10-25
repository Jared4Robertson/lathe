---
id: LA-EXP-DR63
kind: domain_rule
title: "In the Nested view the camera frames the focus box, and depth labels the levels inside it"
parent: LA-EXP-A4
---
In the Nested view, focusing a node by any of the ways `LA-EXP-DR59` lists MUST move the same camera, in the same glide, to frame the focus's box in the pane, within the padding and centered, never zoomed in past twice the map's size. Depth MUST be how many levels inside the focus are labeled: a box nested deeper than that inside the focus MUST be a plain shape until the person zooms in to at least 1.25 times the framed zoom. Otherwise the level of detail is `LA-EXP-DR60`'s: only boxes in view and at least 3 pixels on screen each way are drawn, a parent before its children so a child is drawn over its parent, a level that would take the drawing past 260 boxes is not drawn (its parents stand for it), and a label is drawn only while its title is at least 7 pixels on screen. The keyboard's order is the tree's, a parent before its children. With Links on, the focus's links MUST be drawn as curves between the drawn boxes, and edge hints point to those out of view.
