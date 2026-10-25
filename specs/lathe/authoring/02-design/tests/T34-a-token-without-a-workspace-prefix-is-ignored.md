---
id: LA-AUT-T34
kind: test
title: A token without a workspace product prefix, or not a whole ID, is ignored
parent: LA-AUT
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC03-R03, LA-AUT-DR19]
---
Expects IDs that are no record and have an unknown prefix, or a prefix that only starts like a product, to be ignored, a token followed by a letter, an underscore or lower-case text to be no token, and IDs in brackets, links and sentences to be read whole.
