---
id: LA-BRW-EN03
kind: entity
title: Space
parent: LA-BRW-A2
role: root
links:
  refers_to: [LA-MOD-EN04, LA-BRW-EN01]
---
One product as a place to work in, in the rail.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | The product the space is. | Record reference. | TL |
| Icon | What the rail shows. | Derived: the product's own icon, or its ID as a monogram. | 🧰 |
| Color | The icon's color. | Derived: the product's own color, or one derived from its ID. | Derived from TL, which gives no color |
| Place | Its place in the rail, which Alt and its number opens. | Derived whole number, in the products' ID order. | 2 |
| Last page | The last page visited in the space, for this browser session only. | Page reference, or none. | /TL-LEND-DR05?view=wiki,graph |
