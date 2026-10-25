---
id: TL-LEND-EN05
kind: entity
title: Return
parent: TL-LEND-A3
role: child
---
The end of a loan: when the tool came back and what the librarian found, recorded once and never changed.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Returned at | When the tool came back. | Date and time. | 2026-03-12T16:30:00Z |
| Condition | The tool's condition as the librarian found it. | `good` or `needs_repair`. | good |
| Note | What the librarian noticed. | Text, optional. | Cleaned and charged |
| Late | Whether the return came on a day after the due date, in the library's time zone. | Derived yes or no. | No |
