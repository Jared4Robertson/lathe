---
id: LA-EXP-T93
kind: test
title: The graph opens at depth 1, framing the parent and the children; depth 2 and 3 frame more levels below, and Links brings in the links
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R01]
---
Opens the Define stage's graph and expects the depth buttons 1 to 3 with 1 pressed and no links, then depth 2 framing more records with a new summary; then a requirement's graph with Links on, its linked view and test drawn and a dashed link.
