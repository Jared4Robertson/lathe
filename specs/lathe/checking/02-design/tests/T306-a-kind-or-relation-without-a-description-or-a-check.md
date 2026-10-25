---
id: LA-CHK-T306
kind: test
title: A kind or relation without a description, or a check without its header, is an undocumented error
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-UC25-R06, LA-CHK-DR192, LA-CHK-DR193]
---
Adds a kind and a relation with no description and a check with only a summary, and expects one undocumented error for each.
