---
id: TL-LEND-F01
kind: flow
title: Borrow and return a tool
parent: TL-LEND
links:
  uses: [TL-LEND-V01, TL-LEND-V02, TL-LEND-E03, TL-LEND-E04, TL-LEND-E05]
  fulfills: [TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC04-R01, TL-LEND-UC04-R02, TL-LEND-UC04-R03, TL-LEND-UC04-R04]
---
The everyday path through the library.

1. The member opens the [Catalog](../views/V01-catalog.md), which lists tools with their status (`GET /tools`).
2. The member picks an available tool and borrows it (`POST /loans`). The view shows the due date, or the reason the borrow was refused.
3. When the member brings the tool back, the librarian opens the [Return desk](../views/V02-return-desk.md), records the condition (`POST /loans/{loanId}/return`) and sees whether the return was late.
4. The catalog shows the tool as available, or as needing repair.
