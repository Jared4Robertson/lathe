---
id: LA-CHK-DF01-S05
kind: design_step
title: Lathe's checks run in file order, then the product's own
parent: LA-CHK-DF01
order: 5
statements: one SELECT per check file
links:
  uses: [LA-CHK-C12]
  satisfies: [LA-CHK-UC05-R01, LA-CHK-UC05-R02]
---
Each check file is one SELECT over the same tables, returning `(severity, check, record, message)` rows; each is named by its file name.
