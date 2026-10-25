---
id: LA-CHK-T329
kind: test
title: A Fields table's Meaning column has one name, in any letter case
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-DR182]
---
Expects an entity whose Fields table calls its second column "meaning" to be read with the same fields as its twin's Meaning table, with no `entity-fields` problem, and a header that calls it "Business meaning" not to be a Fields table's header.
