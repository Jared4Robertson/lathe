---
id: LA-PLT-C41
kind: component
title: Product folders
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/folders.ts
links:
  reacts_to: [LA-PLT-EV04]
  satisfies: [LA-PLT-DR26, LA-PLT-DR31, LA-PLT-UC11-R02]
---
`checkFolder` says whether a folder opens and where its specs are, or what is missing; `productNames` reads each product record's title for the window title; `addRecent` and `parseRecent` keep the recent folders list, saved as `recent-folders.json` in the user data folder.
