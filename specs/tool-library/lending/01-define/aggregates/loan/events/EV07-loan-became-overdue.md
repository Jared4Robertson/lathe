---
id: TL-LEND-EV07
kind: domain_event
title: Loan became overdue
parent: TL-LEND-A3
links:
  raised_by: [TL-LEND-EN04]
---
A loan not yet returned became overdue, raised by time passing rather than by anyone's action, at 00:00 on the day after its due date in the library's time zone.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | Which loan is overdue. Loan 31 came back in time; this is what it would have raised had it not. | Loan reference. | Loan 31 |
| Member | Who holds the tool, and now cannot borrow until it is returned. | Member reference. | Member 12 |
| Tool | Which tool is overdue. | Tool reference. | Tool 7 |
| Due date | The last day of the loan, in the library's time zone. | Date. | 2026-03-16 |
| Overdue from | The moment the loan became overdue: 00:00 the next day in the library's time zone. | Date and time. | 2026-03-17T04:00:00Z |
