---
id: LA-AUT-T71
kind: test
title: A Fields table with the wrong columns gives no fields
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC10-R02, LA-AUT-DR52]
---
Expects no fields from a table with other columns, the header read in any letter case, prose allowed between heading and table, and no table found under a later heading.
