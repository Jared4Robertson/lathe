---
id: LA-CHK-DF01-S07
kind: design_step
title: The command prints the report and sets the exit status
parent: LA-CHK-DF01
order: 7
links:
  uses: [LA-CHK-C01]
  satisfies: [LA-CHK-UC01-R01, LA-CHK-UC01-R02]
---
Errors are printed first, then warnings, then a coverage line per domain and obligation kind; the exit status is 1 when there is an error.
