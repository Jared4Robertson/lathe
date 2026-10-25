---
id: LA-MOD-EN07
kind: entity
title: Entity field
parent: LA-MOD-A2
role: child
---
One row of an entity record's Fields table, which only entity records have.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Field | The field's name, used once in the table. | Text, unique in the entity. | Due date |
| Meaning | What the field means in the business. | Text. | The last day of the loan, in the library's time zone. |
| Kind of value | What sort of value the field holds, without storage types. | Text. | Date: the borrow date in the library's time zone plus 14 days. |
| Example | A value from the one case the domain's examples follow. | Text. | 2026-03-16 |
