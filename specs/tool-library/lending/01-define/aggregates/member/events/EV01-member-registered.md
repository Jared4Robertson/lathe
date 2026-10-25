---
id: TL-LEND-EV01
kind: domain_event
title: Member registered
parent: TL-LEND-A1
links:
  raised_by: [TL-LEND-EN01]
---
A librarian registered a new member, who can now borrow tools.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Member ID | The library's number for the new member. | Whole number. | 12 |
| Name | What the member is called. | Text. | Ada Lovelace |
| Email | How the library contacts the member, in lower case. | Email address. | ada@example.org |
| Joined at | When the member was registered. | Date and time. | 2026-03-01T15:20:00Z |
