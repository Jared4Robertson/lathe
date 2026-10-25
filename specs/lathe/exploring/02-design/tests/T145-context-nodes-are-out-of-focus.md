---
id: LA-EXP-T145
kind: test
title: "Context nodes are out of focus: hidden from assistive technology, skipped by the keyboard, left out of the summary and the side bar"
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-DR47]
---
Expects the ring node faded, aria-hidden, unnamed and not a tab stop, with a quiet label; arrow keys visiting the focus nodes only; the summary "2 records · 1 link · 1 more faded"; and the side bar listing one connected record.
