---
id: LA-CHK-T329
kind: test
title: A Fields table may call its Meaning column Business meaning, in any letter case
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R04, LA-CHK-DR209, LA-CHK-DR182]
---
Expects an entity whose Fields table calls its second column "business Meaning" to be read with the same fields as its twin's Meaning table, and no `entity-fields` problem.
