---
id: LA-DSK-C02
kind: component
title: Product folders
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/folders.ts
links:
  reacts_to: [LA-DSK-EV01]
  satisfies: [LA-DSK-DR01, LA-DSK-DR06, LA-DSK-UC01-R02]
---
`checkFolder` says whether a folder opens and where its specs are, or what is missing; `productNames` reads each product record's title for the window title; `addRecent` and `parseRecent` keep the recent folders list, saved as `recent-folders.json` in the user data folder.
