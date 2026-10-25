---
id: LA-TRC-C45
kind: component
title: Traceability section
parent: LA-TRC-LAY06
component_type: react component
file: app/src/specs/Traceability.tsx
links:
  satisfies: [LA-TRC-UC14-R01, LA-TRC-UC14-R02, LA-TRC-UC14-R03, LA-TRC-UC14-R04, LA-EXP-DR27, LA-EXP-DR36, LA-PAT-APP-UX-R05]
  depends_on: [LA-TRC-C46, LA-EXP-C08]
---
`Traceability` draws a record's Traceability section from `traceOf`: the gap callouts (one line per owing domain for a pattern rule), each linked to its check's page; a use case's requirement table; and each group as a titled list of whole-row links (LA-PAT-APP-UX-R05) that names kinds only when the list mixes them, marks designing components built or not built, and shows a test's file with its state. Long lists stay at ten rows with search.
