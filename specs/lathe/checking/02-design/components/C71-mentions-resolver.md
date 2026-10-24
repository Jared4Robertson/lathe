---
id: LA-CHK-C71
kind: component
title: Mentions resolver
parent: LA-CHK
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC13-R01, LA-CHK-UC13-R03, LA-CHK-UC13-R05, LA-CHK-DR70, LA-CHK-DR71, LA-CHK-DR73]
---
`readProseCitations` in the workspace loader: keeps each body's tokens that have a product prefix of the workspace, sets the record's `mentions` to the existing ones, and puts every distinct cited token in the `prose_mentions` table, apart from the `links` table.
