---
id: LA-AUT-EN06
kind: entity
title: Aggregate
parent: LA-AUT-A3
role: root
links:
  has_many: [LA-AUT-EN08, LA-AUT-EN09, LA-AUT-EN10]
  refers_to: [LA-AUT-EN04]
---
One aggregate of a domain: a cluster of records changed together as one unit, drawn as an ERD of its entities.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the aggregate's number. | Text in the ID format. | TL-LEND-A1 |
| Title | The record the aggregate is named for. | Text. | Loan |
| Relates to | Other aggregates it refers to by ID. | List of aggregate references. | TL-LEND-A2 |
