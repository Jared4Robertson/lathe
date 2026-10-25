---
id: LA-PLT-T52
kind: test
title: "A row that leads to one record is one link: every record row on the domain and record pages has exactly one row link, stretched over the row"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R05, LA-EXP-V03-R06]
---
Renders a domain page and a record page and expects every row of every `record-list` (each tree item's own row, and each plain row) that holds a record link to have exactly one `row-link`, a real link to a record's page. Reads `app/src/styles.css` and expects the `row-link` `::after` to be absolute with `inset: 0`, the rows to be `position: relative`, the row's other controls to sit above it with a `z-index`, and the link to give the row a hover tint and a focus ring.
