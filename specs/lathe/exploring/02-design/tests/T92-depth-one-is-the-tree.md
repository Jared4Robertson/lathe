---
id: LA-EXP-T92
kind: test
title: "At depth 1 the graph frames the tree around the focus: its parent or folder at the left edge, its children or their folders, and no other links"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-EXP-UC03-R01]
---
Frames a use case in a folder, a domain, a use case with two kinds of children and a requirement at depth 1 and expects the parent, the children or their groups, no siblings, and only parent lines.
