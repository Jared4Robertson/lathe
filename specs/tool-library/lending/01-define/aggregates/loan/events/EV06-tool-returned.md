---
id: TL-LEND-EV06
kind: domain_event
title: Tool returned
parent: TL-LEND-A3
links:
  raised_by: [TL-LEND-EN05]
---
A librarian recorded a tool's return, which closes its loan and says what condition the tool came back in.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | Which loan the return closes. | Loan reference. | Loan 31 |
| Member | Who returned the tool. | Member reference. | Member 12 |
| Tool | Which tool came back. | Tool reference. | Tool 7 |
| Returned at | When the tool came back. | Date and time. | 2026-03-12T16:30:00Z |
| Condition | The tool's condition as the librarian found it. | `good` or `needs_repair`. | good |
| Note | What the librarian noticed. | Text, optional. | Cleaned and charged |
| Late | Whether the return came on a day after the due date, in the library's time zone. | Yes or no. | No |
