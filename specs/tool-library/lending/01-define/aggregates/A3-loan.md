---
id: TL-LEND-A3
kind: aggregate
title: Loan
parent: TL-LEND
links:
  relates_to: [TL-LEND-A1, TL-LEND-A2]
---
One member holding one tool, from borrowing to return. A loan refers to its [Member](A1-member.md) and its [Tool](A2-tool.md) by ID.

**Business identity:** Loan ID.

| Field | Business meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Loan ID | The library's number for the loan. | Whole number, assigned. | 31 |
| Member | Who borrowed the tool. | Member reference. | Member 12 |
| Tool | Which tool was borrowed. | Tool reference. | Tool 7 |
| Borrowed at | When the loan started. | Date and time. | 2026-03-02T10:00:00Z |
| Due at | When the loan should end. | Date and time: Borrowed at plus 14 days. | 2026-03-16T10:00:00Z |
| Returned at | When the tool came back. | Date and time, or none while active. | 2026-03-12T16:30:00Z |
| Return condition | The condition the librarian recorded on return. | `good` or `needs_repair`, or none while active. | good |
| Return note | What the librarian noticed on return. | Text, optional. | Blade chipped |
| Late | Whether the return came after the due time. | Derived Boolean. | No |
