---
id: LA-BRW-T540
kind: test
title: "The model draws the context ring at each depth: the tree's next level out each way, marked as context, the same every time"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC20-R01, LA-BRW-DR302]
---
Centers on a use case at depth 1, 2 and 3 and expects the focus and context sets at each, the ring one level past the depth with its edges marked as context, the domain's folders as its ring at depth 1, no ring from linked records, and none with the ring switched off.
