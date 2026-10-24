---
id: TL-LEND-E05
kind: endpoint
title: Return a tool
parent: TL-LEND
method: POST
route: "/loans/{loanId}/return"
links:
  fulfills: [TL-LEND-UC04-R01, TL-LEND-UC04-R02, TL-LEND-UC04-R03, TL-LEND-UC04-R04]
---
Request: `{ "condition": "good" | "needs_repair", "note"?: string }`.

| Status | When | Body |
| --- | --- | --- |
| 200 | Returned. | The loan with `dueDate`, `returnedAt`, `returnCondition`, `returnNote`, and `late`: true when returned on a day after the due date in the library's time zone. A `good` return leaves a tool marked needing repair during the loan as it is. |
| 400 `invalid_condition` | Condition missing or not one of the two values. | Error. |
| 404 `loan_not_found` | No such loan. | Error. |
| 409 `already_returned` | The loan was already returned. | Error. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
