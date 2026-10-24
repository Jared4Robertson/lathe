---
id: LA-CHK-UC03-R02
kind: requirement
title: Checks can read every loaded table
parent: LA-CHK-UC03
---
A check's SQL MUST be able to read the records, fields, links, kinds, relations and file facts tables. File facts (whether a `run_by` or `file` path exists, and whether a `run_by` file contains its test's ID) MUST be computed before the checks run, so checks stay in SQL.
