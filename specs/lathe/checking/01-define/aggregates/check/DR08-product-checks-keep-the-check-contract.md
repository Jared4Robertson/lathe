---
id: LA-CHK-DR08
kind: domain_rule
title: A product check keeps the contract of Lathe's checks
parent: LA-CHK-A1
---
A product's own check MUST be one SQL file read and named exactly as Lathe's checks are: one query over the same tables, returning `(severity, check, record, message)` rows, named by its file name. Its problems MUST be ordinary problems, reported with Lathe's.
