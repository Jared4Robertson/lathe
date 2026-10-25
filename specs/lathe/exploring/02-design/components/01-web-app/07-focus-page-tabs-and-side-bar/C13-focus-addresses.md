---
id: LA-EXP-C13
kind: component
title: Focus addresses and views in the link
parent: LA-EXP-LAY08
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-EXP-UC05-R01, LA-EXP-DR08, LA-EXP-DR10, LA-PAT-APP-CODE-R19, LA-PAT-APP-CODE-R20]
---
Builds every address of a record or group, by `addressOf`: a record's bare ID (`/<id>`, a product's and a domain's too) and a group's place in the graph's tree (`/<domain-id>/<stage>/<folder>`, `/<parent-id>/<kind>`); reads the `view` query parameter, by view names only; and says whether a stored page is a focus page's address (`isFocusPath`), so the tabs and the spaces drop any that is not.
