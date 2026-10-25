---
id: LA-AUT-EN04
kind: entity
title: Domain
parent: LA-AUT-A2
role: root
links:
  has_many: [LA-AUT-EN05]
  refers_to: [LA-AUT-EN01]
---
One domain of the product, named for the capability it serves.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The product prefix and the domain's code. | Text in the ID format. | TL-LEND |
| Title | The capability, in the business's words. | Text. | Lending |
| Follows | Patterns the whole domain follows. | List of pattern references. | TL-PAT-LIBRARIAN-ACTION |
