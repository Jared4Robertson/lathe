---
id: LA-CHK-T122
kind: test
title: "A token without a workspace product prefix, or not a whole ID, is ignored"
parent: LA-CHK
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC13-R03, LA-CHK-DR70]
---
Expects IDs with an unknown prefix or a prefix that only starts like a product to be ignored, a token followed by a letter, an underscore or lower-case text to be no token, and IDs in brackets, links and sentences to be read whole.
