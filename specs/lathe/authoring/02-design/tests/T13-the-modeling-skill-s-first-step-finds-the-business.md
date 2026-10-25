---
id: LA-AUT-T13
kind: test
title: The modeling skill's first step finds the business capabilities and makes each a slice, with the questions that tell one from a layer
parent: LA-AUT
test_type: unit
run_by: lathe/test/domain-names.test.ts
links:
  proves: [LA-AUT-UC02-R02]
---
Reads the `model-a-domain` skill and expects its first section to find the business capabilities before any record is written, and to ask at least four questions that tell a capability from a layer.
