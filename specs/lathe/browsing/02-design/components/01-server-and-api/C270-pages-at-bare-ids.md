---
id: LA-BRW-C270
kind: component
title: Pages read from bare IDs
parent: LA-BRW-LAY01
component_type: module
file: app/src/specs/data.ts
links:
  satisfies: [LA-PAT-APP-CODE-R19, LA-BRW-DR280, LA-BRW-UC50-R01]
  depends_on: [LA-BRW-C50]
---
`parseSpecRoute`: reads a path as a page. `/` is the products; a lowercase first word is an app page (Checks, the format reference, or the shell's Settings and Diagrams); an ID is a record, and with the index a product's or a domain's ID is their overview; an ID and more parts is a group; and any other address is missing, which the shell shows as no such page.
