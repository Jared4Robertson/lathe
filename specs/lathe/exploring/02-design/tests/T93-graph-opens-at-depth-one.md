---
id: LA-EXP-T93
kind: test
title: The graph opens at depth 1 with the parent and children only; depth 2 climbs a level more, and Links brings in the links
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R01]
---
Opens a requirement's graph and expects depth buttons 1, 2 and 3 with 1 chosen, its use case shown and no view, test or cross-link; depth 2 brings the Capabilities folder into focus with Define faded beyond it and still no links; Links brings in the view and the test, dashed.
