---
id: LA-AUT-T109
kind: test
title: A kind page shows where the kind sits, its fields, its links in and out by their labels, its checks, an example and its records
parent: LA-AUT
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-AUT-UC15-R02, LA-AUT-UC15-R04]
---
Opens the use case kind's page and expects its description, stage and folder, parent link, the `actor` field's anchor, the ID convention and obligation, links out and in by their labels, the checks that concern it, the first use case's header as code with a link, the record count with a row per parent leading to its group, and the side bar's facts.
