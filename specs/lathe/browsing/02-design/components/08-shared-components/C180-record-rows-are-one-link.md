---
id: LA-BRW-C180
kind: component
title: Record rows are one link
parent: LA-BRW-LAY08
component_type: module
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-BRW-UC03-R05, LA-BRW-DR190, LA-PAT-APP-CODE-R13]
  depends_on: [LA-BRW-C32, LA-BRW-C55]
---
`RecordLink` with `row` marks a row's main link `row-link`. The record rows and trees, problem rows with a record, coverage gaps, open questions, what a requirement fulfills, the patterns a domain follows and the fitness history each mark their one row link. In `app/src/styles.css`, a record list's rows, problem rows and tree rows are positioned; the link's `::after` stretches over the row and carries its hover tint and focus ring; and one rule lifts every other link, button, input and titled badge in the row above it. A tree item's padding sits on its row, so the stretched link covers all of the row and none of its nested rows.
