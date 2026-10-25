---
id: TL-LEND-EV05
kind: domain_event
title: Loan opened
parent: TL-LEND-A3
links:
  raised_by: [TL-LEND-EN04]
---
A member borrowed a tool, and the loan runs until its due date.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | The library's number for the new loan. | Whole number. | 31 |
| Member | Who borrowed the tool. | Member reference. | Member 12 |
| Tool | Which tool was borrowed. | Tool reference. | Tool 7 |
| Borrowed at | When the loan started. | Date and time. | 2026-03-02T10:00:00Z |
| Due date | The last day of the loan, in the library's time zone. | Date: the borrow date plus 14 days. | 2026-03-16 |
