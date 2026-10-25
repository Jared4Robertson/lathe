---
id: LA-EXP-C50
kind: component
title: Record rows are one link
parent: LA-EXP-LAY07
component_type: module
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-EXP-UC02-R05, LA-EXP-V03-R06, LA-PAT-APP-UX-R05]
  depends_on: [LA-TRC-C38, LA-EXP-C18]
---
`RecordLink` with `row` marks a row's main link `row-link`. The record rows and trees, problem rows with a record, coverage gaps, open questions, what a requirement fulfills, the patterns a domain follows and the fitness history each mark their one row link. In `app/src/styles.css`, a record list's rows, problem rows and tree rows are positioned; the link's `::after` stretches over the row and carries its hover tint and focus ring; and one rule lifts every other link, button, input and titled badge in the row above it. A tree item's padding sits on its row, so the stretched link covers all of the row and none of its nested rows.
