---
id: LA-AUT-C15
kind: component
title: Domain placement through capabilities
parent: LA-AUT-LAY04
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC06-R02]
---
`placeRecords` in the workspace loader: walks each record's parents up to its product, taking the first domain it passes, so a record under a capability gets the capability's domain with no special case.
