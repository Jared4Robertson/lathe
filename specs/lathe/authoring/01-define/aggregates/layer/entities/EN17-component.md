---
id: LA-AUT-EN17
kind: entity
title: Component
parent: LA-AUT-A6
role: child
---
A unit of code in the target design, in its domain's layer.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the component's number. | Text in the ID format. | TL-LEND-C02 |
| Type | What sort of code it is. | Text. | service |
| File | Where its code is, which may not exist yet. | File path under the product root. | src/loans.ts |
| Satisfies | What it designs or implements. | List of obligation references. | TL-LEND-DR05 |
