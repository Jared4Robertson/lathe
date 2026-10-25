---
id: LA-AUT-T84
kind: test
title: A kind or relation without a description, or a check without its header, is an undocumented error
parent: LA-AUT
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-AUT-UC12-R06, LA-AUT-DR58, LA-CHK-DR26]
---
Adds a kind and a relation with no description and a check with only a summary, and expects one undocumented error for each.
