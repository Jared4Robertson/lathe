---
id: TL-LEND-EN01
kind: entity
title: Member
parent: TL-LEND-A1
role: root
---
A person registered to borrow tools, known to the library by their email.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Member ID | The library's number for the member, printed on their card. | Whole number, assigned. | 12 |
| Name | What the member is called. | Text, not blank. | Ada Lovelace |
| Email | How the library contacts the member, kept in lower case. | Email address, unique among members. | ada@example.org |
| Joined at | When the member was registered. | Date and time. | 2026-03-01T15:20:00Z |
| Active loans | The member's loans not yet returned, at most 3. | Derived count. | 0 |
| Overdue | Whether any of the member's active loans is past its due date. | Derived yes or no. | No |
