---
id: LA-TRC-T88
kind: test
title: The trace switch shows only the chain for a requirement and is absent for a use case
parent: LA-TRC
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-TRC-UC10-R01, LA-TRC-UC10-R02]
---
Switches on trace mode for a requirement and expects the file nodes to appear and the parent use case to go; Escape leaves trace mode; on a use case there is no switch.
