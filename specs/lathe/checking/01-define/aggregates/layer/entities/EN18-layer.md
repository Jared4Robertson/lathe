---
id: LA-CHK-EN18
kind: entity
title: Layer
parent: LA-CHK-A9
role: root
links:
  refers_to: [LA-MOD-EN04]
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
