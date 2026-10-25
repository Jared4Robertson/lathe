---
id: LA-EXP-C19
kind: component
title: Record rows and record trees
parent: LA-EXP-LAY07
component_type: module
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-EXP-UC05-R05, LA-EXP-UC05-R12, LA-EXP-V03-R02, LA-EXP-V03-R03]
  depends_on: [LA-EXP-C18]
---
`RecordRowBody` (a record's link, key fields, test state, followed pattern, coverage marks and problem badge) and `RecordTree` (records one level below the page's record, their own children folded under them, counted as "4 requirements"), used by the domain, record and group pages and the side bar.
