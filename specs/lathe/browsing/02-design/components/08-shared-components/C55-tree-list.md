---
id: LA-BRW-C55
kind: component
title: Tree list (one level, folded)
parent: LA-BRW-LAY08
component_type: react component
file: app/src/components/TreeList.tsx
links:
  satisfies: [LA-BRW-UC50-R12, LA-BRW-DR54, LA-BRW-DR55, LA-BRW-UC117-R04]
  depends_on: [LA-BRW-C34, LA-BRW-C250]
---
Rows that each fold one level of nested rows under a disclosure button, with the nested count on the row, an Expand all / Collapse all ghost button, opened rows remembered for the session, a search that opens a row just for its match, Right and Left arrow keys as in a tree view, and page-wide expand and collapse for the command palette. It knows nothing about specs and uses the long list inside.
