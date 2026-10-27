---
id: LA-EXP-DR63
kind: domain_rule
title: "Nested: the camera frames the focus box, depth labels inside it"
parent: LA-EXP-A4
---
In the Nested view, focusing a node by any of the ways `LA-EXP-DR59` lists MUST move the same camera, in the same glide, to frame the focus's box in the pane, within the padding and centered, within the camera's zoom limits (`LA-EXP-DR59`). The Nested camera frames the focus's box whatever the depth, so the depth control is off in the Nested view. The level of detail is `LA-EXP-DR60`'s: only boxes in view and at least 3 pixels on screen each way are drawn, each with its label, a parent before its children so a child is drawn over its parent, and a level that would take the drawing past 260 boxes is not drawn (its parents stand for it). The keyboard's order is the tree's, a parent before its children. With Links on, the focus's links MUST be drawn as curves between the drawn boxes, and edge hints point to those out of view.
