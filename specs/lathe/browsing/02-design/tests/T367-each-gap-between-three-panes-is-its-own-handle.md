---
id: LA-BRW-T367
kind: test
title: With three panes open each gap is its own handle, resizing only the two panes beside it
parent: LA-BRW
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-BRW-UC111-R01, LA-BRW-UC111-R02, LA-PAT-APP-CODE-R09]
---
Opens the wiki, graph and model on an aggregate, steps the gap between the graph and the model and expects only those two panes' weights to change, then double-clicks it and expects them even again.
