---
id: LA-EXP-T121
kind: test
title: The Model view is offered only on domain, aggregate and entity pages, opens after Wiki and Graph, and an address naming it elsewhere drops it
parent: LA-EXP
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-EXP-UC11-R01, LA-EXP-DR10]
---
Expects the views a domain, aggregate, entity, use case and product offer, a use case opened with `?view=graph,model` to show only its graph, and on an aggregate Ctrl+4 to open the Model pane third, with the View toggles, and Alt+M to close it.
