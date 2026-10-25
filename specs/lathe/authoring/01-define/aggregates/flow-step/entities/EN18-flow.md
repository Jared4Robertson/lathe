---
id: LA-AUT-EN18
kind: entity
title: Flow
parent: LA-AUT-A7
role: root
links:
  has_many: [LA-AUT-EN19]
---
An end-to-end path through views and endpoints that carries out one or more use cases.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the flow's number. | Text in the ID format. | TL-LEND-F02 |
| Carries out | The use cases it carries out. | List of use case references. | TL-LEND-UC01 |
| Uses | The views and endpoints it passes through. | List of record references. | TL-LEND-V01 |
