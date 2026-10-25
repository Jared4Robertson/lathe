---
id: LA-CHK-EN19
kind: entity
title: Size limit
parent: LA-CHK-A10
role: root
links:
  has_many: [LA-CHK-EN20]
---
The most children of one kind a record of the product should hold.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | The product the limit is for. | Record reference. | TL |
| Max children | The limit, from the product's config. | Whole number, at least 1; 15 when the config does not give it. | 15 |
