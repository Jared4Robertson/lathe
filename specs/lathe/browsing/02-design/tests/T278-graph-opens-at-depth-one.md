---
id: LA-BRW-T278
kind: test
title: The graph opens at depth 1 with the parent and children only; depth 2 and 3 bring in the links
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC20-R01]
---
Opens a requirement's graph and expects depth buttons 1, 2 and 3 with 1 chosen, its use case shown and no view, test or cross-link; choosing depth 2 brings in the view and the test it links to.
