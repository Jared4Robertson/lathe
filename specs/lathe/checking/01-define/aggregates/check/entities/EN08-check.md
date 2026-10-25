---
id: LA-CHK-EN08
kind: entity
title: Check
parent: LA-CHK-A3
role: root
---
One rule the engine applies, one SQL file that returns rows of severity, check, record and message.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Name | The check's name, from its file name without the number and `.sql`. | Text, unique. | unproved |
| File | The SQL file that holds it. | File path. | lathe/checks/16-unproved.sql |
| Order | When it runs: Lathe's checks in file name order, then the product's own. | Whole number, from the file name. | 16 |
| Origin | Whether Lathe ships it or the product adds it. | `Lathe` or `product`. | Lathe |
