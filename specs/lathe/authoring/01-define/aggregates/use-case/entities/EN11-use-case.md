---
id: LA-AUT-EN11
kind: entity
title: Use case
parent: LA-AUT-A4
role: root
links:
  has_many: [LA-AUT-EN12]
  refers_to: [LA-AUT-EN03]
---
One use case: an actor, a goal, and the domain rules it applies.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the use case's number. | Text in the ID format. | TL-LEND-UC01 |
| Actor | The roles that carry it out. | List of role names. | Member |
| Applies | The domain rules it relies on. | List of domain rule references. | TL-LEND-DR01 |
| Follows | The patterns it follows, with a value for each of their settings. | List of pattern references. | TL-PAT-LIBRARIAN-ACTION |
