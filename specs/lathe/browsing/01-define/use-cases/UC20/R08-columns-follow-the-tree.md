---
id: LA-BRW-UC20-R08
kind: requirement
title: The graph is laid out in columns that follow the parent/child tree
parent: LA-BRW-UC20
---
The graph MUST be laid out left to right in columns by depth in the parent/child tree around the focused record: its ancestors one column each to its left, the root furthest left; the focus; its children, or the groups over them, in the next column; their members in the next; and so on. Every record with the same parent, record or group, MUST sit in the same column whatever its kind (see LA-BRW-DR120). A record reached only by a cross-link MUST sit one column after the record it is reached from on the shortest path from the focus; a record that is also in the tree keeps its tree position. Parent/child lines MUST be drawn as the solid spine of the tree, passing through a group in its own column where the parent's children are grouped (see LA-BRW-UC40), and every other relation as a lighter, dashed cross-link. Links between records in one column MUST be drawn but MUST NOT stop the graph being laid out in columns, so every graph is drawn in columns. In trace mode the graph MUST also read left to right in its own columns: the requirement or rule, what fulfills it, the components, the tests, then the files.
