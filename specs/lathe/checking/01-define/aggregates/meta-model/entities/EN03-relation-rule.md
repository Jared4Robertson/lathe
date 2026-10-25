---
id: LA-CHK-EN03
kind: entity
title: Relation rule
parent: LA-CHK-A1
role: child
links:
  refers_to: [LA-CHK-EN02]
---
One allowed link, one row of the relations file: a relation from one kind to another, and what it does.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Relation | The relation's name, as a record's `links` gives it. | Text. | proves |
| Source kind | The kind of record the link starts from. | Kind reference. | test |
| Target kind | The kind of record the link may point to. | Kind reference, or `*` for any kind. | domain_rule |
| Role | What the link does for coverage. | `design`, `proof`, or none. | proof |
| Description | What the link means. | Text. | The test proves the domain rule. |
