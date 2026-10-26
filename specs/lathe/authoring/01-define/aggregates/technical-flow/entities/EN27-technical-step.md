---
id: LA-AUT-EN27
kind: entity
title: Technical step
parent: LA-AUT-A14
role: child
---
One step of a technical flow: its place, the component that does it and what it designs.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Step | The step's record. | Record reference. | LA-CHK-DF01-S05 |
| Order and path | Its place on its path of the technical flow. | Whole number, unique on the path; a short path name. | 5, main |
| Uses | The component that does it. | Component reference. | LA-CHK-C12 |
| Satisfies | The obligations it designs. | List of record references. | LA-CHK-UC05-R01 |
| Transaction, locks and statements | The transaction it runs in, what it locks and how many statements it runs. | Text, optional. | one SELECT per check file |
