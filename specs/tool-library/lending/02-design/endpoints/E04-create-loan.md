---
id: TL-LEND-E04
kind: endpoint
title: Borrow a tool
parent: TL-LEND
method: POST
route: /loans
links:
  fulfills: [TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC03-R04]
---
Request: `{ "memberId": number, "toolId": number }`.

| Status | When | Body |
| --- | --- | --- |
| 201 | Lent. | The loan: `id`, `memberId`, `toolId`, `borrowedAt`, `dueDate` (YYYY-MM-DD in the library's time zone), `returnedAt` (null). |
| 400 `invalid_request` | An ID is missing or not a positive whole number. | Error. |
| 404 `member_not_found` / `tool_not_found` | No such member or tool. | Error. |
| 409 `member_overdue` | The member has a loan whose due date, in the library's time zone, has passed. | Error. |
| 409 `loan_limit_reached` | The member holds 3 active loans. | Error. |
| 409 `tool_needs_repair` | The tool needs repair. | Error. |
| 409 `tool_on_loan` | The tool is on loan. | Error. |

The checks run in the table's order; the first that fails is returned.

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
