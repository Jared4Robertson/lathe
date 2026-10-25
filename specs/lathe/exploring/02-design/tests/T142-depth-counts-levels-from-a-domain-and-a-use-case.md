---
id: LA-EXP-T142
kind: test
title: Depth counts levels below a domain and a use case, as a file explorer does
parent: LA-EXP
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR46]
---
Frames a domain at depths 1 to 3 and expects its stages, then their folders, then what is in them, one level more each time; and a use case in a capability, its capability the only node above it at every depth.
