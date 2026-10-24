---
id: LA-BRW-T62
kind: test
title: The trace switch shows only the chain for a requirement and is absent for a use case
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC21-R01, LA-BRW-UC21-R02]
---
Switches on trace mode for a requirement and expects the file nodes to appear and the parent use case to go; Escape leaves trace mode; on a use case there is no switch.
