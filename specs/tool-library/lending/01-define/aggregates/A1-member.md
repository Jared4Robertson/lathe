---
id: TL-LEND-A1
kind: aggregate
title: Member
parent: TL-LEND
links:
  reacts_to: [TL-LEND-EV05, TL-LEND-EV06, TL-LEND-EV07]
---
A person registered to borrow tools. A member's loans are held by the [Loan](A3-loan.md) aggregate; the member rules below count them.

**Business identity:** Email.

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Member ID | The library's number for the member. | Whole number, assigned. | 12 |
| Name | What the member is called. | Text, not blank. | Ada Lovelace |
| Email | How the library contacts the member. Stored in lower case. | Email address, unique. | ada@example.org |
| Joined at | When the member was registered. | Date and time. | 2026-03-02T10:00:00Z |
| Active loans | The member's loans that are not yet returned. | Derived count. | 2 |
| Overdue | Whether any active loan is past its due date, counted in calendar days in the library's time zone. | Derived Boolean. | No |
