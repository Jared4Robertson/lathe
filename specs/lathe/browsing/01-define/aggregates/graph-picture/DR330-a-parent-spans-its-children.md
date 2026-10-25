---
id: LA-BRW-DR330
kind: domain_rule
title: "A parent spans its children: the hierarchy is an icicle"
parent: LA-BRW-A12
---
In the hierarchy, a node whose children are drawn in the next column MUST be exactly as tall as those children stacked, the gaps between them included, and their stack MUST start at the parent's top edge, so the parent spans its children exactly; children stack in the tree's order. A leaf, and a node whose children are not drawn, MUST keep the one node height, and a "+N more" chip counts as one child slot; no node is taller than its children need. The context ring's children count like any others, so the last level spans the ring beside it. The levels above the center span what they show: at depth 1 the parent spans only the center (and any of the center's linked siblings), so it is as tall as the center.

Columns MUST keep one width and stay a level apart. Each parent line MUST be drawn as a short level line from the parent's right edge to the child's left edge at the child's middle; cross-links (the Links switch) and context-ring lines MUST keep their straight box-to-box lines and labels, drawn over the icicle. A tree that is not the center's (a record the Links switch brings) MUST go in the nearest free place in its columns to the node it was reached from, overlapping nothing. A trace is a chain, not a tree: its columns MUST stay stacks of leaf-height boxes. Both layouts are computed directly, and the same picture MUST always give the same layout.
