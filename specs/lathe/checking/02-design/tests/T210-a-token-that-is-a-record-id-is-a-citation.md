---
id: LA-CHK-T210
kind: test
title: A token that is the ID of a record is a citation, whatever its prefix
parent: LA-CHK
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-CHK-UC18-R01, LA-CHK-DR120]
---
Loads a workspace with no `idPrefixes` and expects a use case to mention a pattern whose ID has no product or domain prefix.
