---
id: LA-BRW-T277
kind: test
title: "At depth 1 the graph is the tree around the focus: its parent or folder above, its children or their folders below, no other links"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC20-R01, LA-BRW-UC40-R02]
---
Centers at depth 1 on a use case in a folder (the folder, folded, above and its requirement below), a domain (its product above and one folder per kind of child below), a use case with many requirements (their folder below) and a requirement (its use case only). Expects only parent/child links, and expects an opened folder to show its members.
