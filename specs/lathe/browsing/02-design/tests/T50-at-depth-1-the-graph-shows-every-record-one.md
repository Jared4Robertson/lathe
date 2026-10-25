---
id: LA-BRW-T50
kind: test
title: Depth counts levels of the tree each way, stages and folders included; siblings and links are not added
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R01]
---
Centers on a requirement at depth 1, 2 and 3 and expects its use case, then the Capabilities folder, then Define above it, with the next level out as context, each node at its level; and an aggregate's folder above and rules below, with no sibling and no cross-link.
