---
id: TL-LEND-E04-R05
kind: interaction_requirement
title: A borrow returns 201 with the loan and its due date
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R01, TL-LEND-DR07]
---
A successful borrow MUST return 201 with the loan: `id`, `memberId`, `toolId`, `borrowedAt` (an ISO 8601 time), `dueDate` (a date, YYYY-MM-DD, in the library's time zone) and `returnedAt` (null). It MUST NOT carry a due time.
