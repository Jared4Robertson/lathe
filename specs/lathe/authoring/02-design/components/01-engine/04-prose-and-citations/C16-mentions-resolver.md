---
id: LA-AUT-C16
kind: component
title: Mentions resolver
parent: LA-AUT-LAY05
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC03-R01, LA-CHK-UC03-R03, LA-CHK-UC03-R05, LA-AUT-DR19, LA-AUT-DR20, LA-AUT-DR22]
---
`readProseCitations` in the workspace loader: keeps each body's tokens that are citations (records' IDs and tokens with a known prefix), sets the record's `mentions` to the existing ones, and puts every distinct cited token in the `prose_mentions` table, apart from the `links` table.
