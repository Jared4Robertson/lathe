---
id: LA-CHK-EN01
kind: entity
title: Meta-model
parent: LA-CHK-A1
role: root
links:
  has_many: [LA-CHK-EN02, LA-CHK-EN03, LA-CHK-EN04, LA-CHK-EN05]
---
The rules for records, stored as three CSV files that are changed only by editing them and reviewing the diff.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Kinds file | Where the kinds of record are listed. | File path. | lathe/meta/kinds.csv |
| Relations file | Where the relation rules are listed. | File path. | lathe/meta/relations.csv |
| Sections file | Where the folders are listed. | File path. | lathe/meta/sections.csv |
