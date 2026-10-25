---
id: LA-BRW-T543
kind: test
title: "Depth counts levels from a domain and from a use case, as a file explorer does"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC20-R01, LA-BRW-DR301]
---
From a domain expects its stages at depth 1, their folders at depth 2 and the records in them at depth 3; from a use case in a capability, the capability, then the Capabilities folder, then Define.
