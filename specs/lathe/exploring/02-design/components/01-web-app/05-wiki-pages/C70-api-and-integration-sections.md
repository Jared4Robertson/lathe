---
id: LA-EXP-C70
kind: component
title: API and integration sections
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/ApiParts.tsx
links:
  satisfies: [LA-EXP-UC13-R01, LA-EXP-UC13-R02]
  implements: [LA-EXP-V03]
  depends_on: [LA-EXP-C19]
---
`ApiSections` lists an API's endpoints and its shared requirements, and `IntegrationSections` an integration's exchanges with its system, each as a tree of rows; `RecordContent` shows them on those kinds' pages in place of the plain list of children.
