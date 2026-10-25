---
id: LA-BRW-T172
kind: test
title: "Only the record's mentions are linked, and unknown IDs look broken"
parent: LA-BRW
test_type: unit
run_by: app/test/mentions.test.tsx
links:
  proves: [LA-BRW-UC60-R06, LA-BRW-UC60-R07]
---
Expects a record's prose links to be its mentions, its broken IDs those its warnings name.
