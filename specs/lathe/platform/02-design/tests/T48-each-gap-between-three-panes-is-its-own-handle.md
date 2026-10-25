---
id: LA-PLT-T48
kind: test
title: With three panes open each gap is its own handle, resizing only the two panes beside it
parent: LA-PLT
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-PLT-UC05-R01, LA-PLT-UC05-R02, LA-PAT-APP-UX-R02]
---
Opens the wiki, graph and model on an aggregate, steps the gap between the graph and the model and expects only those two panes' weights to change, then double-clicks it and expects them even again.
