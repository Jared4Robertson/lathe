---
id: LA-BRW-C56
kind: component
title: Record rows and record trees
parent: LA-BRW
component_type: module
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-BRW-UC50-R05, LA-BRW-UC50-R12, LA-BRW-DR54, LA-BRW-DR55]
  depends_on: [LA-BRW-C55]
---
`RecordRowBody` (a record's link, key fields, test state, followed pattern, coverage marks and problem badge) and `RecordTree` (records one level below the page's record, their own children folded under them, counted as "4 requirements"), used by the domain, record and group pages and the inspector.
