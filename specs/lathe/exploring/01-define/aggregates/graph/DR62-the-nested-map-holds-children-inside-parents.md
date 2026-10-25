---
id: LA-EXP-DR62
kind: domain_rule
title: "The Nested map holds each box's children inside it"
parent: LA-EXP-A4
---
In the Nested view the graph MUST lay out the same tree as the Tree view (`LA-EXP-DR45`) once per load of the specs, as a treemap of rectangles: each box's area in proportion to the leaf records under it (a leaf counts one), the whole map 1.6 times as wide as it is tall. A box with children MUST show its label in a header band at its top and hold its children below it, inside a padding and a gap apart, squarified in the tree's order (row after row along the shorter side, never sorted by size), so no two siblings overlap and no child leaves its parent. A box's text MUST be in proportion to the box and fixed when the map is built (`LA-EXP-DR58`): the largest that fits its label on one line across its width and, for a box with children, keeps its header band within a quarter of its height; a leaf's label is centered in it. A domain is a rectangle there, with a small hexagon mark in its header (`LA-EXP-DR61` holds in the Tree view). The focus never changes the map, and filters hide boxes without moving the rest. No parent lines are drawn: holding is the parent link.
