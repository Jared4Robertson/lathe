---
id: LA-AUT-EN16
kind: entity
title: Layer
parent: LA-AUT-A6
role: root
links:
  has_many: [LA-AUT-EN17]
---
One ordered part of a domain's technical specification, which holds components.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Layer | The layer's record. | Record reference. | TL-LEND-LAY02 |
| Domain | The domain it belongs to, which its components belong to too. | Record reference. | TL-LEND |
| Order | Its place in the domain. | Whole number, unique in the domain. | 2 |
| Title | What it holds. | Text. | Services |
| Components | How many components it holds. | Derived count. | 3 |
