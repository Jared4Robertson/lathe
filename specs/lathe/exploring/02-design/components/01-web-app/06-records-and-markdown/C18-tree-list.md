---
id: LA-EXP-C18
kind: component
title: Tree list (one level, folded)
parent: LA-EXP-LAY07
component_type: react component
file: app/src/components/TreeList.tsx
links:
  satisfies: [LA-EXP-UC05-R12, LA-EXP-V03-R02, LA-EXP-V03-R03, LA-PLT-UC08-R04]
  depends_on: [LA-EXP-C09, LA-PLT-C32]
---
Rows that each fold one level of nested rows under a disclosure button, with the nested count on the row, an Expand all / Collapse all ghost button, opened rows remembered for the session, a search that opens a row just for its match, Right and Left arrow keys as in a tree view, and page-wide expand and collapse for the command palette. It knows nothing about specs and uses the long list inside.
