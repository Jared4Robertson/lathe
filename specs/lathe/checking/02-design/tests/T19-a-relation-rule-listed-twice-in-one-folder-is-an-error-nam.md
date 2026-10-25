---
id: LA-CHK-T19
kind: test
title: A relation rule listed twice in one folder is an error naming that folder
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R06, LA-AUT-DR23]
---
Expects one `meta-duplicate-relation` error naming the extension's `relations.csv` for the rule it lists twice, and no error for the default rules it restates.
