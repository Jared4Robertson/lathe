---
id: LA-BRW-T66
kind: test
title: The page draws a solid parent/child spine and announces the radial fallback
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC20-R08]
---
Renders the graph page and expects the use case above the requirement above the component above the test, a solid parent/child line, and no notice; then renders a graph with a cycle between aggregates and expects a notice naming it.
