---
id: LA-AUT-T48
kind: test
title: A token that is the ID of a record is a citation, whatever its prefix
parent: LA-AUT
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-AUT-UC07-R01, LA-AUT-DR27]
---
Loads a workspace with no `idPrefixes` and expects a use case to mention a pattern whose ID has no product or domain prefix.
