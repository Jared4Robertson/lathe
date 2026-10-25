---
id: LA-MOD-EN03
kind: entity
title: Diagram link
parent: LA-MOD-A1
role: child
links:
  refers_to: [LA-MOD-EN02]
---
One line of the diagram between two terms, one row of its `links.csv`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Source | The term the link starts from. | Term reference, by name. | Person |
| Relation | How the two terms are related. | Text. | contains |
| Target | The term the link goes to. | Term reference, by name. | Experience |
| Cardinality | How many of the target one source has. | Text, optional. | one to many |
| Status | How settled the link is. | `decided`, `draft` or `open`. | decided |
| Note | Anything the line needs to say. | Text, optional. | None |
