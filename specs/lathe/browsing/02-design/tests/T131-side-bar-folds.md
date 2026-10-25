---
id: LA-BRW-T131
kind: test
title: The side bar shows the record in the Graph view and folds away, remembered per view mode
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R11, LA-BRW-DR53, LA-BRW-UC119-R02]
---
Expects the side bar open in a record's Graph view with the record and what the graph connects, hides it with its own button, expects the main view to take the space and the choice remembered in the Graph view of another record, shows it again and expects that record, and expects the Wiki view still closed, its own choice.
