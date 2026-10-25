---
id: LA-BRW-C233
kind: component
title: Traceability section
parent: LA-BRW-LAY11
component_type: react component
file: app/src/specs/Traceability.tsx
links:
  satisfies: [LA-BRW-UC118-R01, LA-BRW-UC118-R02, LA-BRW-UC118-R03, LA-BRW-UC118-R04, LA-BRW-DR144, LA-BRW-DR160, LA-PAT-APP-UX-R05]
  depends_on: [LA-BRW-C234, LA-BRW-C33]
---
`Traceability` draws a record's Traceability section from `traceOf`: the gap callouts (one line per owing domain for a pattern rule), each linked to its check's page; a use case's requirement table; and each group as a titled list of whole-row links (LA-PAT-APP-UX-R05) that names kinds only when the list mixes them, marks designing components built or not built, and shows a test's file with its state. Long lists stay at ten rows with search.
