---
id: LA-BRW-C20
kind: component
title: Graph model
parent: LA-BRW
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-DR20, LA-BRW-DR21, LA-BRW-DR120, LA-BRW-UC20-R01, LA-BRW-UC20-R02, LA-BRW-UC20-R05, LA-BRW-UC20-R08, LA-BRW-UC21-R01, LA-BRW-UC21-R02]
---
Pure functions over the indexed workspace: the neighbourhood of a record to a depth with filters, the column of each node by its depth in the parent/child tree around the focus (a cross-linked record one column after the record it was reached from, a tree position winning over a cross-link) and its row within the column (by its parent's row, then kind order, then ID), the trace chain of a requirement or rule with its own columns by kind, the breadcrumb trail, the group nodes (one per child kind, folded unless opened, with marks summarising their members), and the gaps and summary the inspector shows.
