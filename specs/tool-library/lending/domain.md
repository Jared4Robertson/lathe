---
id: TL-LEND
kind: domain
title: Lending
parent: TL
---
Lending covers everything the library does: its members, its catalog of tools, and the loans between them.

## Language

| Term | Meaning |
| --- | --- |
| Member | A person registered to borrow tools. |
| Librarian | A volunteer who runs the library: registers members, adds tools, takes returns and records repairs. |
| Tool | One physical item in the catalog, such as a particular drill. |
| Condition | The state of a tool: `good` or `needs_repair`. |
| Loan | One member holding one tool from when it is borrowed until it is returned. |
| Active loan | A loan that has not been returned. |
| Library time zone | The time zone in which the library counts days. A setting; `America/New_York` unless set. |
| Due date | The last day of a loan: 14 calendar days after it starts, in the library's time zone. |
| Overdue | An active loan on any day after its due date, in the library's time zone. |

## Example values

These are decided for this example: a loan is due 14 calendar days after it starts; days are counted in the library's time zone, `America/New_York` by default; a member holds at most 3 active loans; a tool that needs repair cannot be lent, and a good return does not clear damage reported during the loan; a member with an overdue loan cannot borrow, with no grace period and no librarian override.
