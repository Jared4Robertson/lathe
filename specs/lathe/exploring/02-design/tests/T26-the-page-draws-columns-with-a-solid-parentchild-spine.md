---
id: LA-EXP-T26
kind: test
title: The page draws columns with a solid parent/child spine
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R08]
---
Renders the graph page and expects the use case left of the requirement, the component and the test together in the column after it, a solid parent/child line; then renders aggregates that relate in a ring and expects them in one column.
