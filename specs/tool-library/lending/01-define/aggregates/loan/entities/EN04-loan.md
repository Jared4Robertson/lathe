---
id: TL-LEND-EN04
kind: entity
title: Loan
parent: TL-LEND-A3
role: root
links:
  has_one: [TL-LEND-EN05]
  refers_to: [TL-LEND-EN01, TL-LEND-EN02]
---
One member holding one tool, from borrowing to return.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | The library's number for the loan. | Whole number, assigned. | 31 |
| Member | Who borrowed the tool. | Member reference. | Member 12 |
| Tool | Which tool was borrowed. | Tool reference. | Tool 7 |
| Borrowed at | When the loan started. | Date and time. | 2026-03-02T10:00:00Z |
| Due date | The last day of the loan, in the library's time zone. | Date: the borrow date in the library's time zone plus 14 days. | 2026-03-16 |
| Overdue | Whether the loan is not returned and today, in the library's time zone, is after its due date. | Derived yes or no; never once returned. | No |
