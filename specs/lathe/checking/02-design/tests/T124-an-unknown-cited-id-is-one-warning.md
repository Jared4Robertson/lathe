---
id: LA-CHK-T124
kind: test
title: "A cited ID with a known prefix that is not a record is one warning"
parent: LA-CHK
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC13-R04, LA-CHK-DR72]
---
Expects a body citing a missing domain rule twice to give exactly one `unknown-id-in-prose` warning on the citing record, with the message in the documented wording.
