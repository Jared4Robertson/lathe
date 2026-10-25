---
id: LA-EXP-T92
kind: test
title: "At depth 1 the graph is the tree around the focus: its parent or folder above, its children or their folders below, no other links, and the next level out faded"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-UC04-R02]
---
Centers at depth 1 on a use case in a folder (the folder, folded, above, its requirement below, the stage faded), a domain (its product above, its stages and open questions below, their folders faded), a use case with two kinds of children (their groups below, the members faded) and a requirement (its use case only). Expects only parent/child links, and an opened folder to show its members.
